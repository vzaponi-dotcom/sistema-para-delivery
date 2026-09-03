import assert from 'node:assert/strict'
import test from 'node:test'
import { cancelOrder, getOrderRefundState, registerOrderRefund } from './orderCancellation.js'

class CancellationDb {
  constructor(order) {
    this.order = { business_id: 'biz', table_tab_id: null, cancelled_at: null, cancel_reason: null, cancel_reason_note: null, ...order }
    this.refund = null
    this.movements = []
    this.tableTabClosed = false
  }

  prepare(sql) {
    const db = this
    return {
      bind(...values) {
        return {
          sql,
          values,
          async first() {
            if (sql.includes('COUNT(*) AS count')) return { count: 0 }
            if (sql.includes('FROM table_tabs')) return null
            if (sql.includes('FROM orders o') && sql.includes('refund_movement_id')) {
              const [orderId, businessId] = values
              if (db.order.id !== orderId || db.order.business_id !== businessId) return null
              return {
                ...db.order,
                payment_id: db.order.payment_id ?? null,
                payment_method: db.order.payment_method ?? null,
                paid_amount_cents: db.order.paid_amount_cents ?? null,
                paid_at: db.order.paid_at ?? null,
                refund_movement_id: db.refund?.id ?? null,
                refund_created_at: db.refund?.created_at ?? null,
              }
            }
            return null
          },
          async run() {
            if (sql.includes("UPDATE orders SET status = 'Cancelado'")) {
              const [cancelledAt, reason, note] = values
              db.order.status = 'Cancelado'
              db.order.cancelled_at = cancelledAt
              db.order.cancel_reason = reason
              db.order.cancel_reason_note = note || null
            }
            if (sql.includes('UPDATE table_tabs SET')) db.tableTabClosed = true
            return { success: true }
          },
        }
      },
    }
  }

  async batch(statements) {
    for (const statement of statements) {
      if (statement.sql?.includes('INSERT INTO movements')) {
        const [id, businessId, type, category, description, value, source, orderId, paymentId, movementDate, createdAt] = statement.values
        this.refund = { id, business_id: businessId, type, category, description, value_cents: value, source, order_id: orderId, payment_id: paymentId, movement_date: movementDate, created_at: createdAt }
        this.movements.push(this.refund)
      } else {
        await statement.run()
      }
    }
    return []
  }
}

const paidOrder = (overrides = {}) => ({
  id: 'o1', status: 'Em preparo', client_name_snapshot: 'Maria', payment_id: 'pay1', payment_method: 'Pix', paid_amount_cents: 8000, paid_at: '2026-09-03T12:00:00.000Z',
  ...overrides,
})

const expectCode = async (promise, code) => assert.rejects(promise, (error) => error?.code === code)

test('refund state is derived instead of persisted', () => {
  assert.equal(getOrderRefundState({ status: 'Em preparo' }), 'none')
  assert.equal(getOrderRefundState({ status: 'Cancelado', paymentId: null }), 'none')
  assert.equal(getOrderRefundState({ status: 'Cancelado', paymentId: 'p1' }), 'pending')
  assert.equal(getOrderRefundState({ status: 'Cancelado', paymentId: 'p1', refundMovementId: 'r1' }), 'refunded')
})

test('cancellation validates reason and other note', async () => {
  await expectCode(cancelOrder(new CancellationDb(paidOrder()), 'biz', 'o1', { refundNow: false }), 'ORDER_CANCEL_REASON_REQUIRED')
  await expectCode(cancelOrder(new CancellationDb(paidOrder()), 'biz', 'o1', { reason: 'invalid', refundNow: false }), 'ORDER_CANCEL_REASON_REQUIRED')
  await expectCode(cancelOrder(new CancellationDb(paidOrder()), 'biz', 'o1', { reason: 'other', note: '   ', refundNow: false }), 'ORDER_CANCEL_REASON_NOTE_REQUIRED')
})

test('unpaid cancellation preserves history without refund movement', async () => {
  const db = new CancellationDb({ id: 'o1', status: 'Em preparo', client_name_snapshot: 'Maria' })
  const result = await cancelOrder(db, 'biz', 'o1', { reason: 'client_changed_mind', refundNow: false }, new Date('2026-09-03T13:00:00.000Z'))
  assert.equal(result.order.status, 'Cancelado')
  assert.equal(result.order.cancelReason, 'client_changed_mind')
  assert.equal(result.order.refundState, 'none')
  assert.equal(result.movement, null)
  assert.equal(db.movements.length, 0)
})

test('paid cancellation can defer the full refund', async () => {
  const db = new CancellationDb(paidOrder())
  const result = await cancelOrder(db, 'biz', 'o1', { reason: 'duplicate_order', refundNow: false }, new Date('2026-09-03T13:00:00.000Z'))
  assert.equal(result.order.refundState, 'pending')
  assert.equal(result.movement, null)
  assert.equal(db.movements.length, 0)
})

test('paid cancellation can create one immediate integral refund', async () => {
  const db = new CancellationDb(paidOrder())
  const result = await cancelOrder(db, 'biz', 'o1', { reason: 'entry_error', refundNow: true, refundMethod: 'Pix' }, new Date('2026-09-03T13:00:00.000Z'))
  assert.equal(result.order.refundState, 'refunded')
  assert.equal(result.movement.source, 'order-refund')
  assert.equal(result.movement.orderId, 'o1')
  assert.equal(db.refund.value_cents, 8000)
  assert.equal(db.refund.payment_id, 'pay1')
  assert.equal(db.refund.source, 'order-refund')
})

test('already cancelled order and invalid deferred refunds are rejected', async () => {
  await expectCode(cancelOrder(new CancellationDb(paidOrder({ status: 'Cancelado' })), 'biz', 'o1', { reason: 'entry_error', refundNow: false }), 'ORDER_ALREADY_CANCELLED')
  await expectCode(registerOrderRefund(new CancellationDb(paidOrder()), 'biz', 'o1', { refundMethod: 'Pix' }), 'ORDER_REFUND_NOT_ALLOWED')
  await expectCode(registerOrderRefund(new CancellationDb({ id: 'o1', status: 'Cancelado', client_name_snapshot: 'Maria' }), 'biz', 'o1', { refundMethod: 'Pix' }), 'ORDER_REFUND_NOT_ALLOWED')
})

test('deferred refund requires method and rejects a second refund', async () => {
  await expectCode(registerOrderRefund(new CancellationDb(paidOrder({ status: 'Cancelado' })), 'biz', 'o1', {}), 'ORDER_REFUND_METHOD_REQUIRED')
  const db = new CancellationDb(paidOrder({ status: 'Cancelado' }))
  db.refund = { id: 'r1', created_at: '2026-09-03T13:00:00.000Z' }
  await expectCode(registerOrderRefund(db, 'biz', 'o1', { refundMethod: 'Pix' }), 'ORDER_ALREADY_REFUNDED')
})
