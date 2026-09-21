import assert from 'node:assert/strict'
import { OperationalDb } from './test-support/operationalDb.js'
import test from 'node:test'
import { cancelOrder } from './orderCancellation.js'
import { createOrder } from './repositories.js'
import { registerTableTabPayment } from './paymentRepository.js'

const timestamp = '2026-09-10T18:00:00.000Z'

class D1Sqlite extends OperationalDb {
  constructor({ withOrder = true } = {}) {
    super({ businesses: ['other-business'] })
    this.beforeBatch = null
    this.batchTail = Promise.resolve()
    this.sqlite.exec(`
      INSERT INTO tables (id, business_id, name, name_key, sort_order, is_active, created_at, updated_at) VALUES
        ('table-1', 'amor-e-sabor', 'Mesa 1', 'MESA 1', 1, 1, '${timestamp}', '${timestamp}'),
        ('table-2', 'amor-e-sabor', 'Mesa 2', 'MESA 2', 2, 1, '${timestamp}', '${timestamp}');
      INSERT INTO table_tabs (id, business_id, table_id, table_identifier, tab_number, status, opened_at, closed_at, created_at, updated_at) VALUES ('tab-1', 'amor-e-sabor', 'table-1', 'Mesa 1', 1, 'open', '${timestamp}', NULL, '${timestamp}', '${timestamp}');
      UPDATE table_tab_counters SET last_number = 1, updated_at = '${timestamp}' WHERE business_id = 'amor-e-sabor';
      INSERT INTO products (id, business_id, category, size, presentation_type, presentation_value, presentation_unit, name, price_cents, active, created_at, updated_at) VALUES ('product-1', 'amor-e-sabor', 'Lanches', 'Un', 'unit', '', '', 'X-Burger', 2500, 1, '${timestamp}', '${timestamp}');
    `)
    if (withOrder) this.insertOrder('order-1', 'tab-1', 'seed-order')
  }

  insertOrder(id, tabId, key) {
    this.sqlite.prepare(`INSERT INTO orders (
      id, business_id, client_id, client_name_snapshot, client_phone_snapshot,
      client_address_snapshot, customer_identity_type, table_tab_id, type,
      order_date, status, scheduled_for, promised_payment_date, is_backdated,
      subtotal_cents, delivery_fee_cents, adjustment_type, adjustment_mode,
      adjustment_value, adjustment_amount_cents, adjustment_reason, total_cents,
      created_at, finished_at, cancelled_at, cancel_reason, cancel_reason_note,
      idempotency_key, order_number
    ) VALUES (?, 'amor-e-sabor', NULL, 'Mesa 1', '', '', 'table', ?, 'Local',
      '2026-09-10', 'Em preparo', NULL, NULL, 0, 2500, 0, 'none', 'fixed', 0,
      0, '', 2500, ?, NULL, NULL, NULL, NULL, ?, (SELECT coalesce(max(order_number), 0) + 1 FROM orders))`)
      .run(id, tabId, timestamp, key)
  }

  concurrentAdapter() {
    return {
      prepare: (sql) => this.prepare(sql),
      batch: (statements) => this.executeBatch(statements),
    }
  }

  async batch(statements) {
    const execute = async () => {
      if (this.beforeBatch) {
        const hook = this.beforeBatch
        this.beforeBatch = null
        await hook()
      }
      return this.executeBatch(statements)
    }
    const pending = this.batchTail.then(execute, execute)
    this.batchTail = pending.catch(() => {})
    return pending
  }
}

const tableOrderInput = (expectedTableTabId = 'tab-1', key = crypto.randomUUID()) => ({
  customerIdentity: { type: 'table', tableId: 'table-1' }, expectedTableTabId,
  type: 'Local', orderDate: '2026-09-10', idempotencyKey: key,
  items: [{ productId: 'product-1', quantity: 1, note: '' }], deliveryFeeCents: 0,
  adjustment: { type: 'none', mode: 'fixed', storedValue: 0, reason: '' }, paymentMethod: null,
})

test('an added order racing full payment cannot leave a closed tab with unpaid work', async () => {
  const db = new D1Sqlite()
  db.beforeBatch = async () => db.insertOrder('order-racing', 'tab-1', 'racing-order')

  await assert.rejects(
    () => registerTableTabPayment(db, 'amor-e-sabor', 'tab-1', [{ methodCode: 'pix', amountCents: 2500 }], new Date(timestamp)),
    (error) => error.status === 409 && error.code === 'TABLE_TAB_PAYMENT_CONFLICT',
  )
  assert.equal(db.sqlite.prepare("SELECT status FROM table_tabs WHERE id = 'tab-1'").get().status, 'open')
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM payments').get().count, 0)
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM movements').get().count, 0)
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM orders WHERE table_tab_id = 'tab-1'").get().count, 2)
})

test('two full payments produce one settlement and one stable conflict', async () => {
  const db = new D1Sqlite()
  const results = await Promise.allSettled([
    registerTableTabPayment(db, 'amor-e-sabor', 'tab-1', [{ methodCode: 'pix', amountCents: 2500 }], new Date(timestamp)),
    registerTableTabPayment(db, 'amor-e-sabor', 'tab-1', [{ methodCode: 'cash', amountCents: 2500 }], new Date(timestamp)),
  ])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  const rejected = results.find((result) => result.status === 'rejected')
  assert.equal(rejected.reason.status, 409)
  assert.match(rejected.reason.code, /^TABLE_TAB_(?:ALREADY_CLOSED|PAYMENT_CONFLICT)$/)
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM payments').get().count, 1)
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM movements').get().count, 1)
  assert.equal(db.sqlite.prepare("SELECT status FROM table_tabs WHERE id = 'tab-1'").get().status, 'closed')
})

test('cancellation that commits after the payment pre-read makes the whole payment batch fail', async () => {
  const db = new D1Sqlite()
  db.beforeBatch = () => cancelOrder(
    db.concurrentAdapter(),
    'amor-e-sabor',
    'order-1',
    { reason: 'client_changed_mind', refundNow: false },
    new Date(timestamp),
  )

  await assert.rejects(
    () => registerTableTabPayment(db, 'amor-e-sabor', 'tab-1', [{ methodCode: 'pix', amountCents: 2500 }], new Date(timestamp)),
    (error) => error.status === 409 && error.code === 'TABLE_TAB_PAYMENT_CONFLICT',
  )
  assert.equal(db.sqlite.prepare("SELECT status FROM orders WHERE id = 'order-1'").get().status, 'Cancelado')
  assert.equal(db.sqlite.prepare("SELECT status FROM table_tabs WHERE id = 'tab-1'").get().status, 'closed')
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM payments WHERE order_id = 'order-1'").get().count, 0)
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM movements WHERE order_id = 'order-1'").get().count, 0)
})

test('payment that commits first preserves existing paid cancellation and deferred-refund behavior', async () => {
  const db = new D1Sqlite()
  await registerTableTabPayment(db, 'amor-e-sabor', 'tab-1', [{ methodCode: 'pix', amountCents: 2500 }], new Date(timestamp))

  const cancelled = await cancelOrder(
    db,
    'amor-e-sabor',
    'order-1',
    { reason: 'client_changed_mind', refundNow: false },
    new Date(timestamp),
  )

  assert.equal(cancelled.order.status, 'Cancelado')
  assert.equal(cancelled.order.paymentStatus, 'Pago')
  assert.equal(cancelled.order.refundState, 'pending')
  assert.equal(cancelled.movement, null)
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM payments WHERE order_id = 'order-1'").get().count, 1)
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM movements WHERE order_id = 'order-1' AND source = 'order-payment'").get().count, 1)
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM movements WHERE order_id = 'order-1' AND source = 'order-refund'").get().count, 0)
  assert.equal(db.sqlite.prepare("SELECT status FROM table_tabs WHERE id = 'tab-1'").get().status, 'closed')
})

test('a stale full-tab batch cannot pay an unpaid order after its tab closes', async () => {
  const db = new D1Sqlite()
  db.beforeBatch = async () => {
    db.sqlite.prepare("UPDATE orders SET status = 'Cancelado' WHERE id = 'order-1'").run()
    db.sqlite.prepare("UPDATE table_tabs SET status = 'closed' WHERE id = 'tab-1'").run()
    db.sqlite.prepare("UPDATE orders SET status = 'Em preparo' WHERE id = 'order-1'").run()
  }

  await assert.rejects(
    () => registerTableTabPayment(db, 'amor-e-sabor', 'tab-1', [{ methodCode: 'pix', amountCents: 2500 }], new Date(timestamp)),
    (error) => error.status === 409 && error.code === 'TABLE_TAB_PAYMENT_CONFLICT',
  )
  assert.equal(db.sqlite.prepare("SELECT status FROM table_tabs WHERE id = 'tab-1'").get().status, 'closed')
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM payments WHERE order_id = 'order-1'").get().count, 0)
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM movements WHERE order_id = 'order-1'").get().count, 0)
})

test('expected table tab identity allows same-tab reuse and rejects close transfer or replacement', async () => {
  const successDb = new D1Sqlite({ withOrder: false })
  const created = await createOrder(successDb, 'amor-e-sabor', tableOrderInput('tab-1', 'same-tab'), new Date(timestamp))
  assert.equal(created.tableTabId, 'tab-1')

  for (const state of ['closed', 'transferred', 'replaced']) {
    const db = new D1Sqlite({ withOrder: false })
    if (state === 'closed') db.sqlite.prepare("UPDATE table_tabs SET status = 'closed' WHERE id = 'tab-1'").run()
    if (state === 'transferred') db.sqlite.prepare("UPDATE table_tabs SET table_id = 'table-2' WHERE id = 'tab-1'").run()
    if (state === 'replaced') db.sqlite.exec(`UPDATE table_tabs SET status = 'closed' WHERE id = 'tab-1'; INSERT INTO table_tabs (id, business_id, table_id, table_identifier, tab_number, status, opened_at, closed_at, created_at, updated_at) VALUES ('tab-2', 'amor-e-sabor', 'table-1', 'Mesa 1', 2, 'open', '${timestamp}', NULL, '${timestamp}', '${timestamp}');`)
    await assert.rejects(
      () => createOrder(db, 'amor-e-sabor', tableOrderInput('tab-1', `stale-${state}`), new Date(timestamp)),
      (error) => error.status === 409 && error.code === 'TABLE_TAB_CHANGED',
    )
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 0)
  }
})

test('order insertion that loses a close race returns 409 and rolls back the whole order batch', async () => {
  const db = new D1Sqlite({ withOrder: false })
  db.beforeBatch = async () => db.sqlite.prepare("UPDATE table_tabs SET status = 'closed' WHERE id = 'tab-1'").run()
  await assert.rejects(
    () => createOrder(db, 'amor-e-sabor', tableOrderInput('tab-1', 'close-race'), new Date(timestamp)),
    (error) => error.status === 409 && error.code === 'TABLE_TAB_CHANGED',
  )
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 0)
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM order_items').get().count, 0)
})

test('repository rejects immediate payment for a table order even without route validation', async () => {
  const db = new D1Sqlite({ withOrder: false })
  await assert.rejects(
    () => createOrder(db, 'amor-e-sabor', { ...tableOrderInput('tab-1', 'paid-table-repository'), paymentMethod: 'Pix' }, new Date(timestamp)),
    (error) => error.status === 400 && error.code === 'TABLE_ORDER_PAYMENT_NOT_ALLOWED',
  )
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 0)
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM payments').get().count, 0)
})
