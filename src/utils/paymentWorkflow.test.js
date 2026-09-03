import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateReceivedToday,
  createOrderPaymentMovement,
  getPendingAmount,
  isOrderPaid,
  normalizePayment,
} from './paymentWorkflow.js'

const paidAt = new Date(2026, 8, 1, 16, 30, 0)

test('normalizes orders without payment data as pending', () => {
  const normalized = normalizePayment({ id: 10, total: 84 })

  assert.equal(normalized.paymentStatus, 'Pendente')
  assert.equal(normalized.paymentMethod, null)
  assert.equal(normalized.paidAt, null)
  assert.equal(normalized.paidAmount, 0)
  assert.equal(isOrderPaid(normalized), false)
  assert.equal(getPendingAmount(normalized), 84)
})

test('normalizes paid orders and defaults paid amount to order total', () => {
  const normalized = normalizePayment({
    id: 11,
    total: 58,
    paymentStatus: 'Pago',
    paymentMethod: 'Pix',
    paidAt: paidAt.toISOString(),
  })

  assert.equal(normalized.paymentStatus, 'Pago')
  assert.equal(normalized.paidAmount, 58)
  assert.equal(isOrderPaid(normalized), true)
  assert.equal(getPendingAmount(normalized), 0)
})

test('creates an automatic financial entry tied to the paid order', () => {
  const movement = createOrderPaymentMovement(
    { id: 123456, client: 'Maria Silva', total: 84 },
    'Cartão de débito',
    paidAt,
    999,
  )

  assert.equal(movement.id, 999)
  assert.equal(movement.type, 'entrada')
  assert.equal(movement.category, 'Vendas')
  assert.equal(movement.value, 84)
  assert.equal(movement.paymentMethod, 'Cartão de débito')
  assert.equal(movement.source, 'order-payment')
  assert.equal(movement.orderId, 123456)
  assert.match(movement.description, /Maria Silva/)
  assert.equal(movement.createdAt, paidAt.toISOString())
})

test('received today nets same-day order refunds against order payments', () => {
  const movements = [
    { type: 'entrada', source: 'order-payment', value: 80, createdAt: '2026-09-03T13:00:00.000Z' },
    { type: 'saida', source: 'order-refund', value: 80, createdAt: '2026-09-03T14:00:00.000Z' },
    { type: 'entrada', source: 'manual', value: 500, createdAt: '2026-09-03T15:00:00.000Z' },
  ]

  assert.equal(calculateReceivedToday(movements, '2026-09-03'), 0)
})

test('a refund on another day does not rewrite the original received day', () => {
  const movements = [
    { type: 'entrada', source: 'order-payment', value: 80, createdAt: '2026-09-03T13:00:00.000Z' },
    { type: 'saida', source: 'order-refund', value: 80, createdAt: '2026-09-04T14:00:00.000Z' },
  ]

  assert.equal(calculateReceivedToday(movements, '2026-09-03'), 80)
  assert.equal(calculateReceivedToday(movements, '2026-09-04'), -80)
})
