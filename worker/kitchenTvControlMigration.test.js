import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { createSettingsDb } from './test-support/settingsDb.js'

const migrations = new URL('../migrations/', import.meta.url)
const MIGRATION = '0032_kitchen_tv_control.sql'
const BUSINESS = 'amor-e-sabor'
const OTHER = 'outra-cozinha'
const NOW = '2026-09-28T20:00:00.000Z'

const insertOrder = (sqlite, { id, businessId = BUSINESS, status = 'Em preparo', finishedAt = null, cancelledAt = null }) => {
  sqlite.prepare(`INSERT INTO orders (
    id, business_id, client_name_snapshot, type, order_date, status,
    subtotal_cents, total_cents, created_at, finished_at, scheduled_for,
    cancelled_at, order_number
  ) VALUES (?, ?, ?, 'Entrega', '2026-09-28', ?, 1000, 1000, ?, ?, NULL, ?, ?)`)
    .run(id, businessId, `Cliente ${id}`, status, NOW, finishedAt, cancelledAt, id === 'other-order' ? 2 : 1)
}

test('0032 installs control and hidden-order tables on a clean database', () => {
  const fixture = createSettingsDb()
  try {
    const { sqlite } = fixture
    for (const table of ['kitchen_tv_display_control', 'kitchen_tv_hidden_orders']) {
      assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name=?").get(table).n, 1)
    }
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='trigger' AND name='kitchen_tv_hidden_orders_terminal_cleanup'").get().n, 1)
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
  } finally {
    fixture.close()
  }
})

test('0032 upgrades the exact pre-0032 schema without losing Kitchen TV state', () => {
  const files = readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()
  const index = files.indexOf(MIGRATION)
  assert.ok(index >= 0, '0032 migration must exist')

  const sqlite = new DatabaseSync(':memory:')
  try {
    for (const file of files.slice(0, index)) sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'))
    sqlite.exec('PRAGMA foreign_keys = ON')
    sqlite.prepare("INSERT INTO businesses (id,slug,name,created_at,updated_at) VALUES ('upgrade','upgrade','Upgrade',?,?)").run(NOW, NOW)
    sqlite.prepare(`INSERT INTO kitchen_tv_access (
      business_id, pairing_token_hash, pairing_expires_at, session_token_hash,
      session_issued_at, paired_at, last_seen_at, revoked_at, created_at, updated_at
    ) VALUES ('upgrade',NULL,NULL,'session-hash',?,?,?,NULL,?,?)`).run(NOW, NOW, NOW, NOW, NOW)

    sqlite.exec(readFileSync(new URL(MIGRATION, migrations), 'utf8'))

    assert.equal(sqlite.prepare("SELECT session_token_hash FROM kitchen_tv_access WHERE business_id='upgrade'").get().session_token_hash, 'session-hash')
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM kitchen_tv_display_control").get().n, 0)
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM kitchen_tv_hidden_orders").get().n, 0)
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), [])
  } finally {
    sqlite.close()
  }
})

test('control constraints reject invalid revision and page values', () => {
  const fixture = createSettingsDb()
  try {
    const { sqlite } = fixture
    assert.throws(() => sqlite.prepare(`INSERT INTO kitchen_tv_display_control
      (business_id, revision, requested_page, updated_at) VALUES (?, -1, 1, ?)`).run(BUSINESS, NOW))
    assert.throws(() => sqlite.prepare(`INSERT INTO kitchen_tv_display_control
      (business_id, revision, requested_page, updated_at) VALUES (?, 0, 0, ?)`).run(BUSINESS, NOW))
    sqlite.prepare(`INSERT INTO kitchen_tv_display_control
      (business_id, revision, requested_page, updated_at) VALUES (?, 0, 1, ?)`).run(BUSINESS, NOW)
    assert.throws(() => sqlite.prepare(`UPDATE kitchen_tv_display_control SET reported_page_count = 0 WHERE business_id = ?`).run(BUSINESS))
    assert.throws(() => sqlite.prepare(`UPDATE kitchen_tv_display_control SET reported_viewport_width = 0 WHERE business_id = ?`).run(BUSINESS))
  } finally {
    fixture.close()
  }
})

test('hidden orders are business-scoped, unique and cleaned on terminal transition', () => {
  const fixture = createSettingsDb()
  try {
    const { sqlite } = fixture
    sqlite.prepare('INSERT INTO businesses (id,slug,name,created_at,updated_at) VALUES (?,?,?,?,?)')
      .run(OTHER, OTHER, 'Outra cozinha', NOW, NOW)
    insertOrder(sqlite, { id: 'order-1' })
    insertOrder(sqlite, { id: 'other-order', businessId: OTHER })

    sqlite.prepare('INSERT INTO kitchen_tv_hidden_orders (business_id, order_id, hidden_at) VALUES (?,?,?)')
      .run(BUSINESS, 'order-1', NOW)
    assert.throws(() => sqlite.prepare('INSERT INTO kitchen_tv_hidden_orders (business_id, order_id, hidden_at) VALUES (?,?,?)')
      .run(BUSINESS, 'order-1', NOW))
    assert.throws(() => sqlite.prepare('INSERT INTO kitchen_tv_hidden_orders (business_id, order_id, hidden_at) VALUES (?,?,?)')
      .run(BUSINESS, 'other-order', NOW))

    sqlite.prepare("UPDATE orders SET status='Finalizado', finished_at=? WHERE id='order-1'").run('2026-09-28T20:10:00.000Z')
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM kitchen_tv_hidden_orders WHERE order_id='order-1'").get().n, 0)

    insertOrder(sqlite, { id: 'order-cancel' })
    sqlite.prepare('INSERT INTO kitchen_tv_hidden_orders (business_id, order_id, hidden_at) VALUES (?,?,?)')
      .run(BUSINESS, 'order-cancel', NOW)
    sqlite.prepare("UPDATE orders SET status='Cancelado', cancelled_at=? WHERE id='order-cancel'").run('2026-09-28T20:11:00.000Z')
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM kitchen_tv_hidden_orders WHERE order_id='order-cancel'").get().n, 0)
  } finally {
    fixture.close()
  }
})
