import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { mapOrderRow } from './repositories.js'

const repositoriesUrl = new URL('./repositories.js', import.meta.url)

test('order mapping exposes cancellation and refund identity for bootstrap/history', () => {
  const order = mapOrderRow({
    id: 'o1', client_name_snapshot: 'Maria', type: 'Entrega', status: 'Cancelado', order_date: '2026-09-03',
    subtotal_cents: 8000, total_cents: 8000, created_at: '2026-09-03T12:00:00.000Z', finished_at: null,
    cancelled_at: '2026-09-03T13:00:00.000Z', cancel_reason: 'client_changed_mind', cancel_reason_note: null,
    payment_id: 'p1', payment_method: 'Pix', paid_at: '2026-09-03T12:30:00.000Z', paid_amount_cents: 8000,
    refund_movement_id: 'r1', refund_created_at: '2026-09-03T13:05:00.000Z',
  })

  assert.equal(order.cancelledAt, '2026-09-03T13:00:00.000Z')
  assert.equal(order.cancelReason, 'client_changed_mind')
  assert.equal(order.cancelReasonNote, '')
  assert.equal(order.paymentId, 'p1')
  assert.equal(order.refundMovementId, 'r1')
  assert.equal(order.refundState, 'refunded')
})

test('order select and table-tab pending queries are cancellation aware', async () => {
  const source = await readFile(repositoriesUrl, 'utf8')
  assert.match(source, /o\.cancelled_at[\s\S]*o\.cancel_reason[\s\S]*o\.cancel_reason_note/)
  assert.match(source, /r\.id AS refund_movement_id[\s\S]*source = 'order-refund'/)

  const pendingClauses = source.match(/o\.status <> 'Cancelado'/g) ?? []
  assert.ok(pendingClauses.length >= 2, 'closeTableTabIfSettled and registerTableTabPayment must both exclude Cancelado')
})
