import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from './test-support/settingsDb.js'
import { loadCancellationReasons, saveCancellationReasons } from './cancellationSettingsRepository.js'
import { cancelOrder } from './orderCancellation.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-12T17:00:00.000Z')

function setup(t) {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  fixture.sqlite.prepare(`INSERT INTO orders (id, business_id, client_name_snapshot, type, order_date, status,
    subtotal_cents, total_cents, created_at) VALUES (?, ?, 'Cliente', 'Retirada', '2026-09-12',
    'Em preparo', 1000, 1000, ?)`).run('order-1', BUSINESS, NOW.toISOString())
  return fixture
}

async function addCustom(db, id = 'weather-delay') {
  const before = await loadCancellationReasons(db, BUSINESS)
  const data = structuredClone(before.data)
  data.items.push({ id, label: id === 'weather-delay' ? 'Chuva forte' : 'TrÃ¢nsito', active: true, sortOrder: data.items.length })
  return saveCancellationReasons(db, BUSINESS, { expectedRevision: before.revision, mutationId: `add-${id}`, data }, NOW)
}

test('cancellation accepts an active custom reason and marks first use in the same transaction', async (t) => {
  const { db, sqlite } = setup(t)
  const created = await addCustom(db)

  const result = await cancelOrder(db, BUSINESS, 'order-1', {
    reason: 'weather-delay', expectedRevision: created.resource.revision, refundNow: false,
  }, new Date(+NOW + 1000))

  assert.equal(result.order.cancelReason, 'weather-delay')
  assert.equal(sqlite.prepare("SELECT first_used_at FROM business_cancel_reasons WHERE id = 'weather-delay'").get().first_used_at, new Date(+NOW + 1000).toISOString())
})

test('revision-zero defaults initialize atomically on first cancellation for a new business', async (t) => {
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  sqlite.prepare('INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run('new-business', 'new-business', 'New', NOW.toISOString(), NOW.toISOString())
  sqlite.prepare(`INSERT INTO orders (id, business_id, client_name_snapshot, type, order_date, status,
    subtotal_cents, total_cents, created_at) VALUES (?, ?, 'Cliente', 'Retirada', '2026-09-12',
    'Finalizado', 1000, 1000, ?)`).run('new-order', 'new-business', NOW.toISOString())

  const result = await cancelOrder(db, 'new-business', 'new-order', {
    reason: 'client_changed_mind', expectedRevision: 0, refundNow: false,
  }, new Date(+NOW + 1000))

  assert.equal(result.order.cancelReason, 'client_changed_mind')
  assert.equal(sqlite.prepare("SELECT revision FROM business_cancellation_settings WHERE business_id = 'new-business'").get().revision, 1)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM business_cancel_reasons WHERE business_id = 'new-business'").get().n, 5)
  assert.equal(sqlite.prepare("SELECT first_used_at FROM business_cancel_reasons WHERE business_id = 'new-business' AND id = 'client_changed_mind'").get().first_used_at, new Date(+NOW + 1000).toISOString())
})

test('Other requires a non-empty note of at most 240 characters', async (t) => {
  const { db } = setup(t)
  await assert.rejects(cancelOrder(db, BUSINESS, 'order-1', { reason: 'other', note: '   ', expectedRevision: 1 }), {
    code: 'ORDER_CANCEL_REASON_NOTE_REQUIRED', status: 400,
  })
  await assert.rejects(cancelOrder(db, BUSINESS, 'order-1', { reason: 'other', note: 'x'.repeat(241), expectedRevision: 1 }), {
    code: 'ORDER_CANCEL_REASON_NOTE_TOO_LONG', status: 400,
  })
})

test('inactive and cross-business reasons are rejected without changing the order', async (t) => {
  const { db, sqlite } = setup(t)
  const created = await addCustom(db)
  const disabled = structuredClone(created.resource.data)
  disabled.items.find(({ id }) => id === 'weather-delay').active = false
  const saved = await saveCancellationReasons(db, BUSINESS, {
    expectedRevision: 2, mutationId: 'disable', data: disabled,
  }, new Date(+NOW + 1000))
  sqlite.exec("INSERT INTO businesses VALUES ('other-business', 'other', 'Other', '2026-09-12', '2026-09-12')")
  sqlite.prepare(`INSERT INTO business_cancellation_settings (business_id, revision, created_at, updated_at)
    VALUES ('other-business', 1, ?, ?)`).run(NOW.toISOString(), NOW.toISOString())
  sqlite.prepare(`INSERT INTO business_cancel_reasons
    (business_id, id, label, name_key, active, is_system, requires_note, sort_order)
    VALUES ('other-business', 'private-reason', 'Privado', 'privado', 1, 0, 0, 0)`).run()

  await assert.rejects(cancelOrder(db, BUSINESS, 'order-1', {
    reason: 'weather-delay', expectedRevision: saved.resource.revision, refundNow: false,
  }), { code: 'POLICY_CHANGED', status: 409 })
  await assert.rejects(cancelOrder(db, BUSINESS, 'order-1', {
    reason: 'private-reason', expectedRevision: saved.resource.revision, refundNow: false,
  }), { code: 'ORDER_CANCEL_REASON_REQUIRED', status: 400 })
  assert.equal(sqlite.prepare("SELECT status FROM orders WHERE id = 'order-1'").get().status, 'Em preparo')
})

test('a cancellation failure rolls back first-use marking and all existing effects', async (t) => {
  const { db, sqlite } = setup(t)
  const created = await addCustom(db)
  sqlite.exec("CREATE TRIGGER reject_cancel BEFORE UPDATE ON orders WHEN NEW.status = 'Cancelado' BEGIN SELECT RAISE(ABORT, 'injected order failure'); END")

  await assert.rejects(cancelOrder(db, BUSINESS, 'order-1', {
    reason: 'weather-delay', expectedRevision: created.resource.revision, refundNow: false,
  }, new Date(+NOW + 1000)))
  assert.equal(sqlite.prepare("SELECT first_used_at FROM business_cancel_reasons WHERE id = 'weather-delay'").get().first_used_at, null)
  assert.equal(sqlite.prepare("SELECT status FROM orders WHERE id = 'order-1'").get().status, 'Em preparo')
})

test('a concurrently cancelled order cannot mark another reason as used', async (t) => {
  const { db, sqlite } = setup(t)
  const created = await addCustom(db)
  const racingDb = {
    prepare: db.prepare,
    async batch(statements) {
      sqlite.prepare("UPDATE orders SET status = 'Cancelado', cancelled_at = ?, cancel_reason = 'entry_error' WHERE id = 'order-1'")
        .run(new Date(+NOW + 500).toISOString())
      return db.batch(statements)
    },
  }

  await assert.rejects(cancelOrder(racingDb, BUSINESS, 'order-1', {
    reason: 'weather-delay', expectedRevision: created.resource.revision, refundNow: false,
  }, new Date(+NOW + 1000)), { code: 'ORDER_ALREADY_CANCELLED', status: 409 })
  assert.equal(sqlite.prepare("SELECT first_used_at FROM business_cancel_reasons WHERE id = 'weather-delay'").get().first_used_at, null)
  assert.equal(sqlite.prepare("SELECT cancel_reason FROM orders WHERE id = 'order-1'").get().cancel_reason, 'entry_error')
})

test('delete versus first cancellation has one valid winner and never leaves a lost reference', async (t) => {
  const { db, sqlite } = setup(t)
  const created = await addCustom(db)
  const removed = structuredClone(created.resource.data)
  removed.items = removed.items.filter(({ id }) => id !== 'weather-delay')

  const [use, deletion] = await Promise.allSettled([
    cancelOrder(db, BUSINESS, 'order-1', {
      reason: 'weather-delay', expectedRevision: created.resource.revision, refundNow: false,
    }, new Date(+NOW + 1000)),
    saveCancellationReasons(db, BUSINESS, {
      expectedRevision: created.resource.revision, mutationId: 'delete-race', data: removed,
    }, new Date(+NOW + 1000)),
  ])

  assert.equal([use, deletion].filter(({ status }) => status === 'fulfilled').length, 1)
  const order = sqlite.prepare("SELECT status, cancel_reason FROM orders WHERE id = 'order-1'").get()
  const reason = sqlite.prepare("SELECT first_used_at FROM business_cancel_reasons WHERE business_id = ? AND id = 'weather-delay'").get(BUSINESS)
  if (use.status === 'fulfilled') {
    assert.deepEqual({ ...order }, { status: 'Cancelado', cancel_reason: 'weather-delay' })
    assert.ok(reason?.first_used_at)
    assert.equal(deletion.reason.code, 'SETTINGS_ITEM_USED')
  } else {
    assert.equal(use.reason.code, 'POLICY_CHANGED')
    assert.deepEqual({ ...order }, { status: 'Em preparo', cancel_reason: null })
    assert.equal(reason, undefined)
  }
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_tx_assertions').get().n, 0)
})

test('historical backfill is permanent and prevents later rename', async (t) => {
  const fixture = createSettingsDb({ beforeSpecB(sqlite) {
    sqlite.prepare(`INSERT INTO orders (id, business_id, client_name_snapshot, type, order_date, status,
      subtotal_cents, total_cents, created_at, cancelled_at, cancel_reason)
      VALUES ('old-cancelled', ?, 'Cliente', 'Retirada', '2026-09-01', 'Cancelado', 1000, 1000, ?, ?, 'entry_error')`)
      .run(BUSINESS, '2026-09-01T10:00:00.000Z', '2026-09-01T11:00:00.000Z')
  } })
  t.after(fixture.close)
  const loaded = await loadCancellationReasons(fixture.db, BUSINESS)
  assert.equal(loaded.meta.items.entry_error.usedEver, true)
  assert.equal(fixture.sqlite.prepare("SELECT first_used_at FROM business_cancel_reasons WHERE id = 'entry_error'").get().first_used_at, '2026-09-01T11:00:00.000Z')
})
