import test from 'node:test'
import assert from 'node:assert/strict'
import { listOrders } from './orderReadRepository.js'

class OrderReadDb {
  prepare(sql) {
    return {
      bind() {
        return {
          async all() {
            if (sql.includes('FROM orders o')) {
              assert.match(sql, /o\.cancelled_at/)
              assert.match(sql, /o\.cancel_reason/)
              assert.match(sql, /o\.cancel_reason_note/)
              assert.match(sql, /r\.id AS refund_movement_id/)
              assert.match(sql, /r\.created_at AS refund_created_at/)
              assert.match(sql, /source = 'order-refund'/)
              return {
                results: [
                  {
                    id: 'o1', client_id: 'c1', client_name_snapshot: 'Maria', customer_identity_type: 'registered_client', table_tab_id: null,
                    type: 'Entrega', order_date: '2026-09-03', status: 'Cancelado', subtotal_cents: 8000, delivery_fee_cents: 0,
                    adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0, adjustment_amount_cents: 0, adjustment_reason: '',
                    total_cents: 8000, created_at: '2026-09-03T12:00:00.000Z', finished_at: null,
                    cancelled_at: '2026-09-03T13:00:00.000Z', cancel_reason: 'client_changed_mind', cancel_reason_note: null,
                    payment_id: 'pay-1', payment_method: 'Pix', paid_at: '2026-09-03T12:05:00.000Z', paid_amount_cents: 8000,
                    refund_movement_id: 'refund-1', refund_created_at: '2026-09-03T13:05:00.000Z',
                  },
                  {
                    id: 'o2', client_id: 'c2', client_name_snapshot: 'João', customer_identity_type: 'registered_client', table_tab_id: null,
                    type: 'Retirada', order_date: '2026-09-01', status: 'Cancelado', subtotal_cents: 4500, delivery_fee_cents: 0,
                    adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0, adjustment_amount_cents: 0, adjustment_reason: '',
                    total_cents: 4500, created_at: '2026-09-01T12:00:00.000Z', finished_at: null,
                    cancelled_at: null, cancel_reason: null, cancel_reason_note: null,
                    payment_id: null, payment_method: null, paid_at: null, paid_amount_cents: null,
                    refund_movement_id: null, refund_created_at: null,
                  },
                ],
              }
            }
            if (sql.includes('FROM order_items')) return { results: [] }
            return { results: [] }
          },
        }
      },
    }
  }
}

test('orders-only reads preserve official cancellation and refund identity', async () => {
  const [order, legacy] = await listOrders(new OrderReadDb(), 'amor-e-sabor')

  assert.equal(order.cancelledAt, '2026-09-03T13:00:00.000Z')
  assert.equal(order.refundMovementId, 'refund-1')
  assert.equal(order.refundedAt, '2026-09-03T13:05:00.000Z')
  assert.equal(order.refundState, 'refunded')
  assert.equal(legacy.cancelledAt, null)
})
