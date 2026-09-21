import test from 'node:test'
import assert from 'node:assert/strict'
import { mapMovementRow } from './financeRepository.js'

test('movement mapper exposes finance metadata', () => {
  assert.deepEqual(mapMovementRow({
    id: 'm1', type: 'entrada', category: 'projects', category_label: 'Projetos', description: 'Pedido', value_cents: 3250,
    source: 'order-payment', order_id: 'o1', payment_id: 'p1', payment_method: 'Pix',
    movement_date: '2026-09-03', created_at: 'created', updated_at: 'updated',
  }), {
    id: 'm1', type: 'entrada', category: 'projects', categoryLabel: 'Projetos', description: 'Pedido', value: 32.5,
    source: 'order-payment', orderId: 'o1', paymentId: 'p1', receiptId: null, paymentAllocationId: null, paymentMethod: 'Pix',
    movementDate: '2026-09-03', date: '2026-09-03', createdAt: 'created', updatedAt: 'updated',
  })
})
