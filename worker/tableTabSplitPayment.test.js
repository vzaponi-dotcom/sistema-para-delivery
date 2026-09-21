import test from 'node:test'
import assert from 'node:assert/strict'
import { OperationalDb } from './test-support/operationalDb.js'
import { registerTableTabPayment } from './paymentRepository.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-21T16:00:00.000Z')
const ISO = NOW.toISOString()

class SplitTableTabDb extends OperationalDb {
  constructor() {
    super()
    this.sqlite.prepare("INSERT INTO tables (id, business_id, name, name_key, sort_order, is_active, created_at, updated_at) VALUES ('table-1', ?, 'Mesa 1', 'mesa 1', 1, 1, ?, ?)")
      .run(BUSINESS, ISO, ISO)
    this.sqlite.prepare("INSERT INTO table_tabs (id, business_id, table_id, table_identifier, tab_number, status, opened_at, closed_at, created_at, updated_at) VALUES ('tab-1', ?, 'table-1', 'Mesa 1', 1, 'open', ?, NULL, ?, ?)")
      .run(BUSINESS, ISO, ISO, ISO)
    for (const [id, total, number] of [['o1', 2000, 1], ['o2', 3000, 2], ['o3', 5000, 3]]) {
      this.sqlite.prepare("INSERT INTO orders (id, business_id, client_id, client_name_snapshot, client_phone_snapshot, client_address_snapshot, customer_identity_type, table_tab_id, type, order_date, status, scheduled_for, promised_payment_date, is_backdated, subtotal_cents, delivery_fee_cents, adjustment_type, adjustment_mode, adjustment_value, adjustment_amount_cents, adjustment_reason, total_cents, created_at, finished_at, cancelled_at, cancel_reason, cancel_reason_note, idempotency_key, order_number) VALUES (?, ?, NULL, 'Mesa 1', '', '', 'table', 'tab-1', 'Local', '2026-09-21', 'Em preparo', NULL, NULL, 0, ?, 0, 'none', 'fixed', 0, 0, '', ?, ?, NULL, NULL, NULL, NULL, ?, ?)")
        .run(id, BUSINESS, total, total, ISO, 'key-' + id, number)
    }
    this.sqlite.prepare("INSERT INTO payments (id, business_id, order_id, amount_cents, method, paid_at, created_at) VALUES ('pay-old', ?, 'o1', 2000, 'Dinheiro', ?, ?)")
      .run(BUSINESS, ISO, ISO)
  }
}

const split = [
  { methodCode: 'cash', amountCents: 2500 },
  { methodCode: 'pix', amountCents: 5500 },
]

test('whole-table split payment creates one receipt, N pending-order payments and movements only by allocation', async () => {
  const db = new SplitTableTabDb()
  const result = await registerTableTabPayment(db, BUSINESS, 'tab-1', split, NOW)

  assert.equal(result.receipt.totalCents, 8000)
  assert.equal(result.receipt.tableTabId, 'tab-1')
  assert.deepEqual(result.allocations.map(({ methodCode, methodLabel, amountCents }) => ({ methodCode, methodLabel, amountCents })), [
    { methodCode: 'cash', methodLabel: 'Dinheiro', amountCents: 2500 },
    { methodCode: 'pix', methodLabel: 'Pix', amountCents: 5500 },
  ])
  assert.deepEqual(result.orders.map(({ id, paymentStatus }) => [id, paymentStatus]), [['o2', 'Pago'], ['o3', 'Pago']])
  assert.equal(result.payments.length, 2)
  assert.ok(result.payments.every((payment) => payment.receiptId === result.receipt.id))
  assert.equal(result.movements.length, 2)
  assert.deepEqual(result.movements.map(({ value, paymentMethod }) => ({ value, paymentMethod })), [
    { value: 25, paymentMethod: 'Dinheiro' },
    { value: 55, paymentMethod: 'Pix' },
  ])
  assert.equal(result.tableTab.status, 'closed')

  const payments = db.sqlite.prepare("SELECT order_id, receipt_id, amount_cents, method FROM payments WHERE receipt_id = ? ORDER BY order_id").all(result.receipt.id)
  assert.deepEqual(payments, [
    { order_id: 'o2', receipt_id: result.receipt.id, amount_cents: 3000, method: null },
    { order_id: 'o3', receipt_id: result.receipt.id, amount_cents: 5000, method: null },
  ])

  const movements = db.sqlite.prepare("SELECT value_cents, order_id, payment_id, receipt_id, payment_allocation_id FROM movements WHERE receipt_id = ? ORDER BY value_cents").all(result.receipt.id)
  assert.deepEqual(movements.map(({ value_cents, order_id, payment_id }) => ({ value_cents, order_id, payment_id })), [
    { value_cents: 2500, order_id: null, payment_id: null },
    { value_cents: 5500, order_id: null, payment_id: null },
  ])
  assert.ok(movements.every(({ receipt_id }) => receipt_id === result.receipt.id))
  assert.equal(new Set(movements.map(({ payment_allocation_id }) => payment_allocation_id)).size, 2)
  assert.equal(movements.reduce((sum, item) => sum + item.value_cents, 0), 8000)
  assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM payments WHERE order_id = 'o1'").get().n, 1)
  assert.equal(db.sqlite.prepare("SELECT status FROM table_tabs WHERE id = 'tab-1'").get().status, 'closed')
})

test('whole-table split payment rolls back receipt, allocations, payments and movements when tab contents race', async () => {
  const db = new SplitTableTabDb()
  const batch = db.batch.bind(db)
  let raced = false
  db.batch = async (statements) => {
    if (!raced) {
      raced = true
      db.sqlite.prepare("INSERT INTO orders (id, business_id, client_id, client_name_snapshot, client_phone_snapshot, client_address_snapshot, customer_identity_type, table_tab_id, type, order_date, status, scheduled_for, promised_payment_date, is_backdated, subtotal_cents, delivery_fee_cents, adjustment_type, adjustment_mode, adjustment_value, adjustment_amount_cents, adjustment_reason, total_cents, created_at, finished_at, cancelled_at, cancel_reason, cancel_reason_note, idempotency_key, order_number) VALUES ('o4', ?, NULL, 'Mesa 1', '', '', 'table', 'tab-1', 'Local', '2026-09-21', 'Em preparo', NULL, NULL, 0, 1000, 0, 'none', 'fixed', 0, 0, '', 1000, ?, NULL, NULL, NULL, NULL, 'key-o4', 4)")
        .run(BUSINESS, ISO)
    }
    return batch(statements)
  }

  await assert.rejects(
    registerTableTabPayment(db, BUSINESS, 'tab-1', split, NOW),
    { status: 409, code: 'TABLE_TAB_PAYMENT_CONFLICT' },
  )

  assert.equal(db.sqlite.prepare("SELECT status FROM table_tabs WHERE id = 'tab-1'").get().status, 'open')
  assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM payments").get().n, 1)
  assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM payment_receipts").get().n, 0)
  assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM payment_allocations").get().n, 0)
  assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM movements WHERE source = 'order-payment'").get().n, 0)
})

test('whole-table split payment rejects an inactive selected method without partial effects', async () => {
  const db = new SplitTableTabDb()
  db.sqlite.exec("UPDATE business_payment_settings SET default_method = 'pix'; UPDATE business_payment_methods SET active = 0 WHERE code = 'cash'")

  await assert.rejects(
    registerTableTabPayment(db, BUSINESS, 'tab-1', split, NOW),
    { status: 409, code: 'POLICY_CHANGED' },
  )

  assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM payments").get().n, 1)
  assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM payment_receipts").get().n, 0)
  assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM movements WHERE source = 'order-payment'").get().n, 0)
  assert.equal(db.sqlite.prepare("SELECT status FROM table_tabs WHERE id = 'tab-1'").get().status, 'open')
})
