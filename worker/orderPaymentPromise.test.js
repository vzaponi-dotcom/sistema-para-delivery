import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePromisedPaymentDate, updateOrderPaymentPromise } from './orderPaymentPromise.js'

const orderRow = (overrides = {}) => ({
  id: 'o1', business_id: 'amor-e-sabor', client_id: 'c1', client_name_snapshot: 'Maria', customer_identity_type: 'registered_client', table_tab_id: null,
  type: 'Entrega', order_date: '2026-09-06', status: 'Finalizado', scheduled_for: null, promised_payment_date: null, is_backdated: 0,
  subtotal_cents: 5000, delivery_fee_cents: 0, adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0, adjustment_amount_cents: 0,
  adjustment_reason: '', total_cents: 5000, created_at: '2026-09-06T12:00:00.000Z', finished_at: null, cancelled_at: null,
  payment_id: null, payment_method: null, paid_at: null, paid_amount_cents: null, refund_movement_id: null, refund_created_at: null, ...overrides,
})

class PromiseDb {
  constructor(row) { this.row = row; this.writes = [] }
  prepare(sql) {
    const db = this
    return { bind(...values) { return {
      async first() { const [id, businessId] = values; return sql.includes('FROM orders') && db.row?.id === id && db.row.business_id === businessId ? db.row : null },
      async all() { return { results: [] } },
      async run() { db.writes.push(sql); if (!/UPDATE orders SET promised_payment_date = \?/i.test(sql)) throw new Error('unexpected write'); const [date, id, businessId] = values; if (db.row?.id === id && db.row.business_id === businessId) db.row.promised_payment_date = date; return { success: true } },
    } } }
  }
}

test('promise parser accepts null/current/future and rejects malformed or past dates', () => {
  assert.equal(parsePromisedPaymentDate(null, '2026-09-06'), null)
  assert.equal(parsePromisedPaymentDate('2026-09-11', '2026-09-06'), '2026-09-11')
  assert.throws(() => parsePromisedPaymentDate('2026-02-31', '2026-09-06'), (error) => error.code === 'INVALID_PROMISED_PAYMENT_DATE')
  assert.throws(() => parsePromisedPaymentDate('2026-09-05', '2026-09-06'), (error) => error.code === 'PROMISED_PAYMENT_DATE_IN_PAST')
})

test('mutation is business scoped, updates only promise, and creates no financial effects', async () => {
  const db = new PromiseDb(orderRow())
  const updated = await updateOrderPaymentPromise(db, 'amor-e-sabor', 'o1', '2026-09-11', new Date('2026-09-06T15:00:00.000Z'))
  assert.equal(updated.promisedPaymentDate, '2026-09-11')
  assert.equal(db.row.order_date, '2026-09-06')
  assert.equal(db.row.status, 'Finalizado')
  assert.equal(db.writes.some((sql) => /INSERT INTO payments|INSERT INTO movements/i.test(sql)), false)
  await assert.rejects(() => updateOrderPaymentPromise(new PromiseDb(orderRow()), 'other-business', 'o1', '2026-09-11'), (error) => error.code === 'ORDER_NOT_FOUND')
})

test('paid and cancelled orders cannot receive a payment promise', async () => {
  await assert.rejects(() => updateOrderPaymentPromise(new PromiseDb(orderRow({ payment_id: 'pay-1' })), 'amor-e-sabor', 'o1', '2026-09-11'), (error) => error.code === 'ORDER_ALREADY_PAID')
  await assert.rejects(() => updateOrderPaymentPromise(new PromiseDb(orderRow({ status: 'Cancelado' })), 'amor-e-sabor', 'o1', '2026-09-11'), (error) => error.code === 'ORDER_CANCELLED')
})
