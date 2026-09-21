import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from './test-support/settingsDb.js'
import { createOrder, registerTableTabPayment, updateOrderStatus } from './repositories.js'
import { registerOrderPayment } from './paymentRepository.js'
import { cancelOrder, registerOrderRefund } from './orderCancellation.js'
import { createManualMovement, updateManualMovement } from './financeRepository.js'
import { loadOperations, saveOperations } from './operationSettingsRepository.js'
import { loadPaymentMethods, savePaymentMethods } from './paymentSettingsRepository.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-12T18:00:00.000Z')
const orderInput = (idempotencyKey, { type = 'Entrega', paymentMethod = null } = {}) => ({
  customerIdentity: { type: 'guest_name', value: 'Cliente teste' }, type, orderDate: '2026-09-12',
  items: [{ productId: 'product-1', quantity: 1, note: '' }], deliveryFeeCents: 0,
  adjustment: { type: 'none', mode: 'fixed', storedValue: 0, reason: '' }, paymentMethod, idempotencyKey,
})
const setup = (t) => {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  fixture.sqlite.prepare(`INSERT INTO products (id, business_id, category, size, name, price_cents, active, created_at, updated_at)
    VALUES ('product-1', ?, 'Meals', '', 'Prato', 2500, 1, ?, ?)`).run(BUSINESS, NOW.toISOString(), NOW.toISOString())
  return fixture
}
const disablePayment = async (db, code, mutationId) => {
  const current = await loadPaymentMethods(db, BUSINESS)
  const data = structuredClone(current.data)
  data.methods.find((item) => item.code === code).active = false
  if (data.defaultMethod === code) data.defaultMethod = data.methods.find((item) => item.active).code
  await savePaymentMethods(db, BUSINESS, { expectedRevision: current.revision, mutationId, data }, NOW)
}

test('accepted checkout replay survives later policy change while new paid checkout is rejected', async (t) => {
  const { db, sqlite } = setup(t)
  const accepted = await createOrder(db, BUSINESS, orderInput('accepted', { paymentMethod: 'Dinheiro' }), NOW)
  await disablePayment(db, 'cash', 'disable-cash')
  const replay = await createOrder(db, BUSINESS, orderInput('accepted', { paymentMethod: 'Dinheiro' }), new Date(+NOW + 1000))
  assert.equal(replay.id, accepted.id)
  await assert.rejects(createOrder(db, BUSINESS, orderInput('rejected', { paymentMethod: 'Dinheiro' }), new Date(+NOW + 2000)), { code: 'POLICY_CHANGED' })
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM orders WHERE idempotency_key = 'rejected'").get().n, 0)
})

test('inactive modality blocks only new orders and does not block finalizing an existing order', async (t) => {
  const { db } = setup(t)
  const existing = await createOrder(db, BUSINESS, orderInput('existing-retirada', { type: 'Retirada' }), NOW)
  const current = await loadOperations(db, BUSINESS)
  const data = structuredClone(current.data)
  data.enabledModalities = data.enabledModalities.filter((item) => item !== 'Retirada')
  await saveOperations(db, BUSINESS, { expectedRevision: current.revision, mutationId: 'disable-retirada', data }, NOW)
  assert.equal((await updateOrderStatus(db, BUSINESS, existing.id, new Date(+NOW + 1000))).status, 'Finalizado')
  await assert.rejects(createOrder(db, BUSINESS, orderInput('new-retirada', { type: 'Retirada' }), new Date(+NOW + 2000)), { code: 'POLICY_CHANGED' })
})

test('inactive Local modality blocks a new table order before opening its tab', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.prepare("INSERT INTO tables (id, business_id, name, name_key, sort_order, is_active, created_at, updated_at) VALUES ('table-local-off', ?, 'Mesa L', 'mesa l', 1, 1, ?, ?)")
    .run(BUSINESS, NOW.toISOString(), NOW.toISOString())
  const current = await loadOperations(db, BUSINESS)
  const data = structuredClone(current.data)
  data.enabledModalities = data.enabledModalities.filter((item) => item !== 'Local')
  if (data.defaultModality === 'Local') data.defaultModality = data.enabledModalities[0]
  await saveOperations(db, BUSINESS, { expectedRevision: current.revision, mutationId: 'disable-local', data }, NOW)

  await assert.rejects(createOrder(db, BUSINESS, {
    ...orderInput('table-local-disabled', { type: 'Local' }),
    customerIdentity: { type: 'table', tableId: 'table-local-off', clientId: null },
  }, new Date(+NOW + 1000)), { code: 'POLICY_CHANGED' })
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM table_tabs WHERE table_id = 'table-local-off'").get().n, 0)
})

test('concurrent Local deactivation returns policy conflict and rolls back a new table tab', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.prepare("INSERT INTO tables (id, business_id, name, name_key, sort_order, is_active, created_at, updated_at) VALUES ('table-local-race', ?, 'Mesa R', 'mesa r', 1, 1, ?, ?)")
    .run(BUSINESS, NOW.toISOString(), NOW.toISOString())
  const batch = db.batch.bind(db)
  db.batch = async (statements) => {
    sqlite.exec("UPDATE business_order_modalities SET active = 0 WHERE code = 'Local'; UPDATE business_operation_settings SET revision = revision + 1")
    return batch(statements)
  }

  await assert.rejects(createOrder(db, BUSINESS, {
    ...orderInput('table-local-race-order', { type: 'Local' }),
    customerIdentity: { type: 'table', tableId: 'table-local-race', clientId: null },
  }, NOW), { code: 'POLICY_CHANGED' })
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM table_tabs WHERE table_id = 'table-local-race'").get().n, 0)
})

test('inactive payment method blocks standalone payment, refund and manual movement without partial effects', async (t) => {
  const { db, sqlite } = setup(t)
  const unpaid = await createOrder(db, BUSINESS, orderInput('unpaid'), NOW)
  const paid = await createOrder(db, BUSINESS, orderInput('paid', { paymentMethod: 'Pix' }), NOW)
  await cancelOrder(db, BUSINESS, paid.id, { reason: 'other', note: 'Teste', refundNow: false }, new Date(+NOW + 1000))
  await disablePayment(db, 'cash', 'disable-cash-all')

  await assert.rejects(registerOrderPayment(db, BUSINESS, unpaid.id, [{ methodCode: 'cash', amountCents: 2500 }], new Date(+NOW + 2000)), { code: 'POLICY_CHANGED' })
  await assert.rejects(registerOrderRefund(db, BUSINESS, paid.id, { refundMethod: 'Dinheiro' }, new Date(+NOW + 2000)), { code: 'POLICY_CHANGED' })
  await assert.rejects(createManualMovement(db, BUSINESS, {
    type: 'saida', category: 'supplies', description: 'Compra', valueCents: 1000,
    paymentMethod: 'Dinheiro', movementDate: '2026-09-12', expectedRevision: 1,
  }, new Date(+NOW + 2000)), { code: 'POLICY_CHANGED' })
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM payments WHERE order_id = ?').get(unpaid.id).n, 0)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM movements WHERE source = 'order-refund'").get().n, 0)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM movements WHERE source = 'manual'").get().n, 0)
})

test('editing a historical manual movement may retain its now-inactive payment method', async (t) => {
  const { db } = setup(t)
  const movement = await createManualMovement(db, BUSINESS, {
    type: 'saida', category: 'supplies', description: 'Compra inicial', valueCents: 1000,
    paymentMethod: 'Dinheiro', movementDate: '2026-09-12', expectedRevision: 1,
  }, NOW)
  await disablePayment(db, 'cash', 'disable-historical-cash')

  const updated = await updateManualMovement(db, BUSINESS, movement.id, {
    type: 'saida', category: 'supplies', description: 'Compra corrigida', valueCents: 1200,
    paymentMethod: 'Dinheiro', movementDate: '2026-09-12', expectedRevision: 1,
  }, new Date(+NOW + 1000))

  assert.equal(updated.paymentMethod, 'Dinheiro')
  assert.equal(updated.value, 12)
})

test('stale historical edit cannot restore an inactive payment method after a concurrent change', async (t) => {
  const { db, sqlite } = setup(t)
  const movement = await createManualMovement(db, BUSINESS, {
    type: 'saida', category: 'supplies', description: 'Compra inicial', valueCents: 1000,
    paymentMethod: 'Dinheiro', movementDate: '2026-09-12', expectedRevision: 1,
  }, NOW)
  await disablePayment(db, 'cash', 'disable-raced-cash')
  const batch = db.batch.bind(db)
  db.batch = async (statements) => {
    sqlite.prepare('UPDATE movements SET payment_method = ? WHERE id = ?').run('Pix', movement.id)
    return batch(statements)
  }

  await assert.rejects(updateManualMovement(db, BUSINESS, movement.id, {
    type: 'saida', category: 'supplies', description: 'Edi\u00e7\u00e3o obsoleta', valueCents: 1200,
    paymentMethod: 'Dinheiro', movementDate: '2026-09-12', expectedRevision: 1,
  }, new Date(+NOW + 1000)), { status: 409, code: 'MOVEMENT_CHANGED' })
  assert.equal(sqlite.prepare('SELECT payment_method FROM movements WHERE id = ?').get(movement.id).payment_method, 'Pix')
})

test('inactive payment method blocks whole-table payment without closing the tab', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.prepare("INSERT INTO tables (id, business_id, name, name_key, sort_order, is_active, created_at, updated_at) VALUES ('table-1', ?, 'Mesa 1', 'mesa 1', 1, 1, ?, ?)")
    .run(BUSINESS, NOW.toISOString(), NOW.toISOString())
  const tableOrder = await createOrder(db, BUSINESS, {
    ...orderInput('table-order', { type: 'Local' }),
    customerIdentity: { type: 'table', tableId: 'table-1', clientId: null },
  }, NOW)
  await disablePayment(db, 'cash', 'disable-table-cash')
  await assert.rejects(registerTableTabPayment(db, BUSINESS, tableOrder.tableTabId, 'Dinheiro', new Date(+NOW + 1000)), { code: 'POLICY_CHANGED' })
  assert.equal(sqlite.prepare('SELECT status FROM table_tabs WHERE id = ?').get(tableOrder.tableTabId).status, 'open')
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM payments WHERE order_id = ?').get(tableOrder.id).n, 0)
})

test('policy change immediately before checkout commit rolls back order, items, payment and print job', async (t) => {
  const { db, sqlite } = setup(t)
  const batch = db.batch.bind(db)
  let raced = false
  db.batch = async (statements) => {
    if (!raced) {
      raced = true
      sqlite.exec("UPDATE business_payment_methods SET active = 0 WHERE code = 'cash'; UPDATE business_payment_settings SET revision = revision + 1")
    }
    return batch(statements)
  }
  await assert.rejects(createOrder(db, BUSINESS, orderInput('raced-order', { paymentMethod: 'Dinheiro' }), NOW), { code: 'POLICY_CHANGED' })
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM orders WHERE idempotency_key = 'raced-order'").get().n, 0)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM order_items').get().n, 0)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM payments').get().n, 0)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM print_jobs').get().n, 0)
})

test('failed table checkout does not leave a newly opened tab without its order', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.prepare("INSERT INTO tables (id, business_id, name, name_key, sort_order, is_active, created_at, updated_at) VALUES ('table-atomic', ?, 'Mesa A', 'mesa a', 1, 1, ?, ?)")
    .run(BUSINESS, NOW.toISOString(), NOW.toISOString())
  db.batch = async () => { throw new Error('FORCED_ORDER_BATCH_FAILURE') }

  await assert.rejects(createOrder(db, BUSINESS, {
    ...orderInput('table-atomic-order', { type: 'Local' }),
    customerIdentity: { type: 'table', tableId: 'table-atomic', clientId: null },
  }, NOW), /FORCED_ORDER_BATCH_FAILURE/)

  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM table_tabs WHERE table_id = 'table-atomic' AND status = 'open'").get().n, 0)
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM orders WHERE idempotency_key = 'table-atomic-order'").get().n, 0)
})
