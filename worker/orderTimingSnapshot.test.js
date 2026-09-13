import test from 'node:test'
import assert from 'node:assert/strict'
import { LEGACY_TIMING } from '../shared/businessPolicies.js'
import { createSettingsDb } from './test-support/settingsDb.js'
import { loadOperations, saveOperations } from './operationSettingsRepository.js'
import { cancelOrder } from './orderCancellation.js'
import { listOrders } from './orderReadRepository.js'
import { createOrder, loadBootstrap, loadOrderById, updateOrderStatus } from './repositories.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-12T18:00:00.000Z')
const CUSTOM_TIMING = {
  scheduledPrepLeadMinutes: 20,
  scheduledLateGraceMinutes: 5,
  immediateLateAfterMinutes: 10,
  immediateVeryLateAfterMinutes: 15,
}

const orderInput = (idempotencyKey) => ({
  customerIdentity: { type: 'guest_name', value: 'Cliente teste' },
  type: 'Entrega',
  orderDate: '2026-09-12',
  items: [{ productId: 'timing-product', quantity: 1, note: '' }],
  deliveryFeeCents: 0,
  adjustment: { type: 'none', mode: 'fixed', storedValue: 0, reason: '' },
  paymentMethod: null,
  idempotencyKey,
})

const setup = (t) => {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  fixture.sqlite.prepare(`INSERT INTO products (id, business_id, category, size, name, price_cents, active, created_at, updated_at)
    VALUES ('timing-product', ?, 'Meals', '', 'Prato', 2500, 1, ?, ?)`).run(BUSINESS, NOW.toISOString(), NOW.toISOString())
  return fixture
}

const saveTiming = async (db, timing, mutationId, now = NOW) => {
  const current = await loadOperations(db, BUSINESS)
  return saveOperations(db, BUSINESS, {
    expectedRevision: current.revision,
    mutationId,
    data: { ...structuredClone(current.data), timing },
  }, now)
}

test('finalization snapshots server timing once and all order read paths expose it', async (t) => {
  const { db, sqlite } = setup(t)
  const order = await createOrder(db, BUSINESS, orderInput('snapshot-finish'), NOW)
  await saveTiming(db, CUSTOM_TIMING, 'timing-before-finish')

  const finishedAt = new Date(+NOW + 60_000)
  const finalized = await updateOrderStatus(db, BUSINESS, order.id, finishedAt)
  assert.deepEqual(finalized.timingPolicySnapshot, CUSTOM_TIMING)
  assert.equal(finalized.finishedAt, finishedAt.toISOString())

  const stored = sqlite.prepare('SELECT timing_policy_snapshot_json FROM orders WHERE id = ?').get(order.id)
  assert.deepEqual(JSON.parse(stored.timing_policy_snapshot_json), CUSTOM_TIMING)
  assert.deepEqual((await loadOrderById(db, BUSINESS, order.id)).timingPolicySnapshot, CUSTOM_TIMING)
  assert.deepEqual((await listOrders(db, BUSINESS))[0].timingPolicySnapshot, CUSTOM_TIMING)
  assert.deepEqual((await loadBootstrap(db, BUSINESS)).orders[0].timingPolicySnapshot, CUSTOM_TIMING)
})

test('repeated finalization preserves finishedAt and snapshot after policy changes', async (t) => {
  const { db, sqlite } = setup(t)
  const order = await createOrder(db, BUSINESS, orderInput('snapshot-repeat'), NOW)
  await saveTiming(db, CUSTOM_TIMING, 'timing-repeat-first')
  const first = await updateOrderStatus(db, BUSINESS, order.id, new Date(+NOW + 60_000))
  await saveTiming(db, { ...LEGACY_TIMING, immediateLateAfterMinutes: 35, immediateVeryLateAfterMinutes: 45 }, 'timing-repeat-second')

  const repeated = await updateOrderStatus(db, BUSINESS, order.id, new Date(+NOW + 120_000))
  assert.equal(repeated.finishedAt, first.finishedAt)
  assert.deepEqual(repeated.timingPolicySnapshot, CUSTOM_TIMING)
  assert.deepEqual(JSON.parse(sqlite.prepare('SELECT timing_policy_snapshot_json FROM orders WHERE id = ?').get(order.id).timing_policy_snapshot_json), CUSTOM_TIMING)
})

test('concurrent timing change aborts finalization without partial history', async (t) => {
  const { db, sqlite } = setup(t)
  const order = await createOrder(db, BUSINESS, orderInput('snapshot-policy-race'), NOW)
  const batch = db.batch.bind(db)
  db.batch = async (statements) => {
    sqlite.exec('UPDATE business_operation_settings SET revision = revision + 1, immediate_late_after_minutes = 11')
    return batch(statements)
  }

  await assert.rejects(updateOrderStatus(db, BUSINESS, order.id, new Date(+NOW + 60_000)), { code: 'POLICY_CHANGED', status: 409 })
  const stored = sqlite.prepare('SELECT status, finished_at, timing_policy_snapshot_json FROM orders WHERE id = ?').get(order.id)
  assert.deepEqual({ ...stored }, { status: 'Em preparo', finished_at: null, timing_policy_snapshot_json: null })
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_tx_assertions').get().n, 0)
})

test('concurrent state transition rejects finalization and does not overwrite it', async (t) => {
  const { db, sqlite } = setup(t)
  const order = await createOrder(db, BUSINESS, orderInput('snapshot-state-race'), NOW)
  const batch = db.batch.bind(db)
  db.batch = async (statements) => {
    sqlite.prepare("UPDATE orders SET status = 'Cancelado', cancelled_at = ?, cancel_reason = 'entry_error' WHERE id = ?")
      .run(new Date(+NOW + 30_000).toISOString(), order.id)
    return batch(statements)
  }

  await assert.rejects(updateOrderStatus(db, BUSINESS, order.id, new Date(+NOW + 60_000)), { code: 'ORDER_ALREADY_CANCELLED', status: 409 })
  const stored = sqlite.prepare('SELECT status, finished_at, timing_policy_snapshot_json FROM orders WHERE id = ?').get(order.id)
  assert.deepEqual({ ...stored }, { status: 'Cancelado', finished_at: null, timing_policy_snapshot_json: null })
})

test('failed finalization rolls snapshot and finishedAt back with the state change', async (t) => {
  const { db, sqlite } = setup(t)
  const order = await createOrder(db, BUSINESS, orderInput('snapshot-rollback'), NOW)
  sqlite.exec(`CREATE TRIGGER reject_timing_snapshot AFTER UPDATE ON orders
    WHEN NEW.status = 'Finalizado' BEGIN SELECT RAISE(ABORT, 'injected finalization failure'); END`)

  await assert.rejects(updateOrderStatus(db, BUSINESS, order.id, new Date(+NOW + 60_000)), /injected finalization failure/)
  const stored = sqlite.prepare('SELECT status, finished_at, timing_policy_snapshot_json FROM orders WHERE id = ?').get(order.id)
  assert.deepEqual({ ...stored }, { status: 'Em preparo', finished_at: null, timing_policy_snapshot_json: null })
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_tx_assertions').get().n, 0)
})

test('cancellation snapshots an active order but never backfills an already-finalized legacy order', async (t) => {
  const { db, sqlite } = setup(t)
  const active = await createOrder(db, BUSINESS, orderInput('snapshot-cancel'), NOW)
  await saveTiming(db, CUSTOM_TIMING, 'timing-before-cancel')
  const cancelled = await cancelOrder(db, BUSINESS, active.id, {
    reason: 'entry_error', expectedRevision: 1, refundNow: false,
  }, new Date(+NOW + 60_000))
  assert.deepEqual(cancelled.order.timingPolicySnapshot, CUSTOM_TIMING)

  sqlite.prepare(`INSERT INTO orders (id, business_id, client_name_snapshot, type, order_date, status,
    subtotal_cents, total_cents, created_at, finished_at) VALUES ('legacy-finished', ?, 'Legado', 'Retirada',
    '2026-09-01', 'Finalizado', 1000, 1000, '2026-09-01T12:00:00.000Z', '2026-09-01T12:30:00.000Z')`).run(BUSINESS)
  const legacy = await cancelOrder(db, BUSINESS, 'legacy-finished', {
    reason: 'entry_error', expectedRevision: 1, refundNow: false,
  }, new Date(+NOW + 120_000))
  assert.equal(legacy.order.timingPolicySnapshot, null)
  assert.equal(sqlite.prepare("SELECT timing_policy_snapshot_json FROM orders WHERE id = 'legacy-finished'").get().timing_policy_snapshot_json, null)
})

test('concurrent timing change aborts cancellation with its reason and print effects', async (t) => {
  const { db, sqlite } = setup(t)
  const order = await createOrder(db, BUSINESS, orderInput('snapshot-cancel-policy-race'), NOW)
  const batch = db.batch.bind(db)
  db.batch = async (statements) => {
    sqlite.exec('UPDATE business_operation_settings SET revision = revision + 1, immediate_late_after_minutes = 11')
    return batch(statements)
  }

  await assert.rejects(cancelOrder(db, BUSINESS, order.id, {
    reason: 'entry_error', expectedRevision: 1, refundNow: false,
  }, new Date(+NOW + 60_000)), (error) => {
    assert.equal(error.code, 'POLICY_CHANGED')
    assert.equal(error.status, 409)
    assert.match(error.message, /configurações operacionais foram alteradas/i)
    assert.doesNotMatch(error.message, /motivos de cancelamento/i)
    return true
  })
  const stored = sqlite.prepare(`SELECT status, cancelled_at, cancel_reason, timing_policy_snapshot_json
    FROM orders WHERE id = ?`).get(order.id)
  assert.deepEqual({ ...stored }, { status: 'Em preparo', cancelled_at: null, cancel_reason: null, timing_policy_snapshot_json: null })
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM print_jobs WHERE order_id = ? AND trigger = 'automatic'").get(order.id).n, 1)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_tx_assertions').get().n, 0)
})

test('cancellation preserves a snapshot committed by concurrent finalization', async (t) => {
  const { db, sqlite } = setup(t)
  const order = await createOrder(db, BUSINESS, orderInput('snapshot-cancel-after-finish'), NOW)
  await saveTiming(db, CUSTOM_TIMING, 'timing-before-concurrent-finish')
  const batch = db.batch.bind(db)
  let finalized = false
  db.batch = async (statements) => {
    if (!finalized) {
      finalized = true
      sqlite.prepare(`UPDATE orders SET status = 'Finalizado', finished_at = ?, timing_policy_snapshot_json = ? WHERE id = ?`)
        .run(new Date(+NOW + 30_000).toISOString(), JSON.stringify(LEGACY_TIMING), order.id)
    }
    return batch(statements)
  }

  const result = await cancelOrder(db, BUSINESS, order.id, {
    reason: 'entry_error', expectedRevision: 1, refundNow: false,
  }, new Date(+NOW + 60_000))
  assert.equal(result.order.status, 'Cancelado')
  assert.deepEqual(result.order.timingPolicySnapshot, LEGACY_TIMING)
  assert.deepEqual(JSON.parse(sqlite.prepare('SELECT timing_policy_snapshot_json FROM orders WHERE id = ?').get(order.id).timing_policy_snapshot_json), LEGACY_TIMING)
})

test('failed cancellation rolls snapshot back together with reason use and print cleanup', async (t) => {
  const { db, sqlite } = setup(t)
  const order = await createOrder(db, BUSINESS, orderInput('snapshot-cancel-rollback'), NOW)
  const beforeUse = sqlite.prepare("SELECT first_used_at FROM business_cancel_reasons WHERE business_id = ? AND id = 'entry_error'").get(BUSINESS).first_used_at
  sqlite.exec(`CREATE TRIGGER reject_timing_cancel AFTER UPDATE ON orders
    WHEN NEW.status = 'Cancelado' BEGIN SELECT RAISE(ABORT, 'injected cancellation failure'); END`)

  await assert.rejects(cancelOrder(db, BUSINESS, order.id, {
    reason: 'entry_error', expectedRevision: 1, refundNow: false,
  }, new Date(+NOW + 60_000)), /injected cancellation failure/)
  const stored = sqlite.prepare(`SELECT status, cancelled_at, cancel_reason, timing_policy_snapshot_json
    FROM orders WHERE id = ?`).get(order.id)
  assert.deepEqual({ ...stored }, { status: 'Em preparo', cancelled_at: null, cancel_reason: null, timing_policy_snapshot_json: null })
  assert.equal(sqlite.prepare("SELECT first_used_at FROM business_cancel_reasons WHERE business_id = ? AND id = 'entry_error'").get(BUSINESS).first_used_at, beforeUse)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM print_jobs WHERE order_id = ? AND trigger = 'automatic'").get(order.id).n, 1)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_tx_assertions').get().n, 0)
})

test('malformed snapshot fails closed instead of becoming current or legacy history', async (t) => {
  const { db, sqlite } = setup(t)
  const order = await createOrder(db, BUSINESS, orderInput('snapshot-invalid'), NOW)
  sqlite.prepare("UPDATE orders SET status = 'Finalizado', finished_at = ?, timing_policy_snapshot_json = '{invalid' WHERE id = ?")
    .run(new Date(+NOW + 60_000).toISOString(), order.id)

  await assert.rejects(loadOrderById(db, BUSINESS, order.id), { code: 'ORDER_TIMING_SNAPSHOT_INVALID', status: 503 })
  await assert.rejects(listOrders(db, BUSINESS), { code: 'ORDER_TIMING_SNAPSHOT_INVALID', status: 503 })
  await assert.rejects(loadBootstrap(db, BUSINESS), { code: 'ORDER_TIMING_SNAPSHOT_INVALID', status: 503 })
})

test('active cancellation rejects a malformed snapshot before changing order, reason, or print state', async (t) => {
  const { db, sqlite } = setup(t)
  const order = await createOrder(db, BUSINESS, orderInput('snapshot-invalid-active-cancel'), NOW)
  sqlite.prepare("UPDATE orders SET timing_policy_snapshot_json = '{invalid' WHERE id = ?").run(order.id)
  const beforeUse = sqlite.prepare("SELECT first_used_at FROM business_cancel_reasons WHERE business_id = ? AND id = 'entry_error'")
    .get(BUSINESS).first_used_at

  await assert.rejects(cancelOrder(db, BUSINESS, order.id, {
    reason: 'entry_error', expectedRevision: 1, refundNow: false,
  }, new Date(+NOW + 60_000)), { code: 'ORDER_TIMING_SNAPSHOT_INVALID', status: 503 })

  const stored = sqlite.prepare(`SELECT status, cancelled_at, cancel_reason, timing_policy_snapshot_json
    FROM orders WHERE id = ?`).get(order.id)
  assert.deepEqual({ ...stored }, {
    status: 'Em preparo', cancelled_at: null, cancel_reason: null, timing_policy_snapshot_json: '{invalid',
  })
  assert.equal(sqlite.prepare("SELECT first_used_at FROM business_cancel_reasons WHERE business_id = ? AND id = 'entry_error'").get(BUSINESS).first_used_at, beforeUse)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM print_jobs WHERE order_id = ? AND trigger = 'automatic' AND status = 'pending'").get(order.id).n, 1)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_tx_assertions').get().n, 0)
})

test('finalized cancellation rejects a malformed snapshot before changing history', async (t) => {
  const { db, sqlite } = setup(t)
  const order = await createOrder(db, BUSINESS, orderInput('snapshot-invalid-final-cancel'), NOW)
  sqlite.prepare("UPDATE orders SET status = 'Finalizado', finished_at = ?, timing_policy_snapshot_json = '{invalid' WHERE id = ?")
    .run(new Date(+NOW + 30_000).toISOString(), order.id)
  const beforeUse = sqlite.prepare("SELECT first_used_at FROM business_cancel_reasons WHERE business_id = ? AND id = 'entry_error'")
    .get(BUSINESS).first_used_at

  await assert.rejects(cancelOrder(db, BUSINESS, order.id, {
    reason: 'entry_error', expectedRevision: 1, refundNow: false,
  }, new Date(+NOW + 60_000)), { code: 'ORDER_TIMING_SNAPSHOT_INVALID', status: 503 })

  const stored = sqlite.prepare(`SELECT status, finished_at, cancelled_at, cancel_reason, timing_policy_snapshot_json
    FROM orders WHERE id = ?`).get(order.id)
  assert.deepEqual({ ...stored }, {
    status: 'Finalizado', finished_at: new Date(+NOW + 30_000).toISOString(), cancelled_at: null,
    cancel_reason: null, timing_policy_snapshot_json: '{invalid',
  })
  assert.equal(sqlite.prepare("SELECT first_used_at FROM business_cancel_reasons WHERE business_id = ? AND id = 'entry_error'").get(BUSINESS).first_used_at, beforeUse)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM movements WHERE order_id = ? AND source = 'order-refund'").get(order.id).n, 0)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM print_jobs WHERE order_id = ? AND trigger = 'automatic' AND status = 'pending'").get(order.id).n, 1)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM settings_tx_assertions').get().n, 0)
})
