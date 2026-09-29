import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'

const migrations = new URL('../migrations/', import.meta.url)
const MIGRATION = '0034_table_reservations.sql'
const BUSINESS = 'amor-e-sabor'
const NOW = '2026-09-29T12:00:00.000Z'

const migrationFiles = () => readdirSync(migrations)
  .filter((name) => name.endsWith('.sql'))
  .sort()

const rows = (sqlite, sql, ...values) => sqlite.prepare(sql).all(...values).map((row) => ({ ...row }))
const one = (sqlite, sql, ...values) => rows(sqlite, sql, ...values)[0]

const applyTransaction = (sqlite, file) => {
  sqlite.exec('BEGIN')
  try {
    sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'))
    sqlite.exec('COMMIT')
  } catch (error) {
    sqlite.exec('ROLLBACK')
    throw error
  }
}

const createDatabaseThrough = (maxMigration) => {
  const sqlite = new DatabaseSync(':memory:')
  try {
    const files = migrationFiles().filter((name) => Number(name.slice(0, 4)) <= maxMigration)
    for (const file of files.filter((name) => Number(name.slice(0, 4)) < 24)) {
      sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'))
    }
    sqlite.exec('PRAGMA foreign_keys = ON')
    for (const file of files.filter((name) => Number(name.slice(0, 4)) >= 24)) {
      applyTransaction(sqlite, file)
    }
    return sqlite
  } catch (error) {
    sqlite.close()
    throw error
  }
}

const readMigration = () => {
  const matches = migrationFiles().filter((name) => Number(name.slice(0, 4)) === 34)
  assert.deepEqual(matches, [MIGRATION], '0034 must be reserved exclusively for table reservations')
  return readFileSync(new URL(MIGRATION, migrations), 'utf8')
}

const seedOrder = (sqlite, id, orderNumber, businessId = BUSINESS) => {
  sqlite.prepare(`INSERT INTO orders (
    id, business_id, client_name_snapshot, customer_identity_type, type,
    order_date, status, subtotal_cents, total_cents, created_at, order_number
  ) VALUES (?, ?, ?, 'table', 'Local', '2026-10-10', 'Em preparo', 1000, 1000, ?, ?)`)
    .run(id, businessId, `Cliente ${id}`, NOW, orderNumber)
}

const activeTable = (sqlite, businessId = BUSINESS, offset = 0) => one(sqlite, `
  SELECT id, name
  FROM tables
  WHERE business_id = ? AND is_active = 1
  ORDER BY sort_order, id
  LIMIT 1 OFFSET ?
`, businessId, offset)

const insertReservation = (sqlite, {
  id,
  orderId,
  tableId,
  tableName = 'Mesa 1',
  status = 'reserved',
  scheduledFor = '2026-10-10T23:00:00.000Z',
  endsAt = '2026-10-11T01:00:00.000Z',
  durationMinutes = 120,
  revision = 1,
  convertedTableTabId = null,
  convertedAt = null,
  cancelledAt = null,
  noShowAt = null,
  businessId = BUSINESS,
}) => sqlite.prepare(`INSERT INTO table_reservations (
  id, business_id, order_id, table_id, table_name_snapshot, status,
  scheduled_for, ends_at, duration_minutes, revision,
  converted_table_tab_id, converted_at, cancelled_at, no_show_at,
  created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  id,
  businessId,
  orderId,
  tableId,
  tableName,
  status,
  scheduledFor,
  endsAt,
  durationMinutes,
  revision,
  convertedTableTabId,
  convertedAt,
  cancelledAt,
  noShowAt,
  NOW,
  NOW,
)

test('0034 defines the reservation entity, ownership links, indexes and overlap guards', () => {
  const sql = readMigration()

  assert.match(sql, /CREATE TABLE table_reservations\s*\(/i)
  assert.match(sql, /business_id TEXT NOT NULL REFERENCES businesses\(id\)/i)
  assert.match(sql, /order_id TEXT NOT NULL REFERENCES orders\(id\)/i)
  assert.match(sql, /table_id TEXT NOT NULL REFERENCES tables\(id\)/i)
  assert.match(sql, /converted_table_tab_id TEXT REFERENCES table_tabs\(id\)/i)
  assert.match(sql, /status TEXT NOT NULL CHECK\s*\(status IN \('reserved', 'converted', 'cancelled', 'no_show'\)\)/i)
  assert.match(sql, /duration_minutes INTEGER NOT NULL CHECK\s*\(duration_minutes > 0\)/i)
  assert.match(sql, /revision INTEGER NOT NULL DEFAULT 1 CHECK\s*\(revision >= 1\)/i)
  assert.match(sql, /CHECK\s*\(scheduled_for < ends_at\)/i)
  assert.match(sql, /CREATE UNIQUE INDEX idx_table_reservations_business_order[\s\S]*\(business_id, order_id\)/i)
  assert.match(sql, /CREATE INDEX idx_table_reservations_business_status_schedule[\s\S]*\(business_id, status, scheduled_for\)/i)
  assert.match(sql, /CREATE INDEX idx_table_reservations_business_table_status_schedule[\s\S]*\(business_id, table_id, status, scheduled_for\)/i)
  assert.match(sql, /CREATE INDEX idx_table_reservations_converted_tab[\s\S]*\(business_id, converted_table_tab_id\)[\s\S]*WHERE converted_table_tab_id IS NOT NULL/i)
  assert.match(sql, /CREATE TRIGGER table_reservations_overlap_insert_guard/i)
  assert.match(sql, /CREATE TRIGGER table_reservations_overlap_update_guard/i)
  assert.match(sql, /RAISE\s*\(ABORT, 'TABLE_RESERVATION_CONFLICT'\)/i)
})

test('0034 clean install enforces reservation checks, terminal metadata and business ownership', () => {
  const sqlite = createDatabaseThrough(34)
  try {
    const tableNames = rows(sqlite, "SELECT name FROM sqlite_master WHERE type='table'").map(({ name }) => name)
    assert.ok(tableNames.includes('table_reservations'))

    const foreignTables = rows(sqlite, 'PRAGMA foreign_key_list(table_reservations)')
      .map(({ table }) => table)
      .sort()
    assert.deepEqual(foreignTables, ['businesses', 'orders', 'table_tabs', 'tables'])

    const table = activeTable(sqlite)
    seedOrder(sqlite, 'order-valid', 9001)

    assert.throws(() => insertReservation(sqlite, {
      id: 'invalid-status',
      orderId: 'order-valid',
      tableId: table.id,
      status: 'waiting',
    }), /CHECK constraint/i)

    assert.throws(() => insertReservation(sqlite, {
      id: 'invalid-duration',
      orderId: 'order-valid',
      tableId: table.id,
      durationMinutes: 0,
    }), /CHECK constraint/i)

    assert.throws(() => insertReservation(sqlite, {
      id: 'invalid-window',
      orderId: 'order-valid',
      tableId: table.id,
      scheduledFor: '2026-10-10T23:00:00.000Z',
      endsAt: '2026-10-10T23:00:00.000Z',
    }), /CHECK constraint/i)

    assert.throws(() => insertReservation(sqlite, {
      id: 'invalid-cancelled',
      orderId: 'order-valid',
      tableId: table.id,
      status: 'cancelled',
      cancelledAt: null,
    }), /CHECK constraint/i)

    sqlite.prepare('INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('foreign-business', 'foreign-business', 'Foreign', NOW, NOW)
    sqlite.prepare(`INSERT INTO tables
      (id, business_id, name, name_key, sort_order, is_active, created_at, updated_at)
      VALUES ('foreign-table', 'foreign-business', 'Mesa F', 'MESA F', 1, 1, ?, ?)`).run(NOW, NOW)
    seedOrder(sqlite, 'foreign-order', 1, 'foreign-business')

    assert.throws(() => insertReservation(sqlite, {
      id: 'cross-business',
      orderId: 'foreign-order',
      tableId: 'foreign-table',
      businessId: BUSINESS,
    }), /TABLE_RESERVATION_SCOPE_MISMATCH/)

    assert.deepEqual(rows(sqlite, 'PRAGMA foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})

test('0034 overlap guards use half-open intervals for insert and update', () => {
  const sqlite = createDatabaseThrough(34)
  try {
    const table = activeTable(sqlite)
    for (const [index, id] of ['order-a', 'order-b', 'order-c', 'order-d'].entries()) {
      seedOrder(sqlite, id, 9100 + index)
    }

    insertReservation(sqlite, {
      id: 'reservation-a',
      orderId: 'order-a',
      tableId: table.id,
      tableName: table.name,
      scheduledFor: '2026-10-10T23:00:00.000Z',
      endsAt: '2026-10-11T01:00:00.000Z',
    })

    assert.doesNotThrow(() => insertReservation(sqlite, {
      id: 'reservation-b',
      orderId: 'order-b',
      tableId: table.id,
      tableName: table.name,
      scheduledFor: '2026-10-11T01:00:00.000Z',
      endsAt: '2026-10-11T03:00:00.000Z',
    }))

    assert.throws(() => insertReservation(sqlite, {
      id: 'reservation-c',
      orderId: 'order-c',
      tableId: table.id,
      tableName: table.name,
      scheduledFor: '2026-10-11T00:59:00.000Z',
      endsAt: '2026-10-11T02:59:00.000Z',
    }), /TABLE_RESERVATION_CONFLICT/)

    assert.throws(() => sqlite.prepare(`UPDATE table_reservations
      SET scheduled_for = ?, ends_at = ?, updated_at = ?
      WHERE id = 'reservation-b'`).run(
      '2026-10-11T00:30:00.000Z',
      '2026-10-11T02:30:00.000Z',
      NOW,
    ), /TABLE_RESERVATION_CONFLICT/)

    assert.deepEqual(
      one(sqlite, "SELECT scheduled_for, ends_at FROM table_reservations WHERE id='reservation-b'"),
      {
        scheduled_for: '2026-10-11T01:00:00.000Z',
        ends_at: '2026-10-11T03:00:00.000Z',
      },
    )

    assert.doesNotThrow(() => insertReservation(sqlite, {
      id: 'reservation-d',
      orderId: 'order-d',
      tableId: table.id,
      tableName: table.name,
      status: 'cancelled',
      scheduledFor: '2026-10-10T23:30:00.000Z',
      endsAt: '2026-10-11T01:30:00.000Z',
      cancelledAt: NOW,
    }))
  } finally {
    sqlite.close()
  }
})

test('0034 upgrades the exact pre-0034 schema without changing existing order or table-tab history', () => {
  const sqlite = createDatabaseThrough(33)
  try {
    const table = activeTable(sqlite)
    seedOrder(sqlite, 'legacy-order', 9200)
    sqlite.prepare(`INSERT INTO table_tabs (
      id, business_id, table_id, table_identifier, tab_number, status,
      opened_at, closed_at, created_at, updated_at
    ) VALUES ('legacy-tab', ?, ?, ?, 9200, 'closed', ?, ?, ?, ?)`).run(
      BUSINESS,
      table.id,
      table.name,
      NOW,
      NOW,
      NOW,
      NOW,
    )

    const orderBefore = one(sqlite, "SELECT * FROM orders WHERE id='legacy-order'")
    const tabBefore = one(sqlite, "SELECT * FROM table_tabs WHERE id='legacy-tab'")

    applyTransaction(sqlite, MIGRATION)

    assert.deepEqual(one(sqlite, "SELECT * FROM orders WHERE id='legacy-order'"), orderBefore)
    assert.deepEqual(one(sqlite, "SELECT * FROM table_tabs WHERE id='legacy-tab'"), tabBefore)
    assert.equal(one(sqlite, 'SELECT count(*) AS n FROM table_reservations').n, 0)
    assert.deepEqual(rows(sqlite, 'PRAGMA foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})
