import test from 'node:test'
import assert from 'node:assert/strict'
import { canReceiveStandaloneOrder } from './orderPaymentEligibility.js'

const pending = (overrides = {}) => ({
  id: 'order-1',
  client: 'Ana',
  type: 'Entrega',
  status: 'Em preparo',
  paymentStatus: 'Pendente',
  customerIdentityType: 'registered_client',
  ...overrides,
})

test('Cozinha recebe Entrega e Retirada pendentes com consulta e recebimento', () => {
  const granted = new Set(['orders.view', 'payments.receive'])

  assert.equal(canReceiveStandaloneOrder(pending(), granted, 'orders'), true)
  assert.equal(canReceiveStandaloneOrder(pending({ type: 'Retirada' }), granted, 'orders'), true)
})

test('Histórico recebe pedido finalizado pendente sem consulta financeira', () => {
  const granted = new Set(['orders.history', 'payments.receive'])
  const order = pending({ status: 'Finalizado' })

  assert.equal(canReceiveStandaloneOrder(order, granted, 'history'), true)
  assert.equal(granted.has('finance.receivables'), false)
})

test('pedido pago ou cancelado nunca recebe entrada operacional', () => {
  const granted = new Set(['orders.view', 'payments.receive'])

  assert.equal(canReceiveStandaloneOrder(pending({ paymentStatus: 'Pago' }), granted, 'orders'), false)
  assert.equal(canReceiveStandaloneOrder(pending({ status: 'Cancelado' }), granted, 'orders'), false)
})

for (const [name, patch] of [
  ['tipo Local', { type: 'Local' }],
  ['tableTabId', { tableTabId: 'tab-1' }],
  ['identidade table', { customerIdentityType: 'table' }],
  ['mesa legada', { table: { id: 'table-1' } }],
  ['tableId legado', { tableId: 'table-1' }],
  ['identificador legado de mesa', { tableIdentifier: 'Mesa 1' }],
]) test(`pedido com ${name} permanece exclusivo da comanda`, () => {
  const granted = new Set(['orders.view', 'payments.receive'])

  assert.equal(canReceiveStandaloneOrder(pending(patch), granted, 'orders'), false)
})

test('origem ou capacidades ausentes não ganham concessão implícita', () => {
  const order = pending({ status: 'Finalizado' })

  assert.equal(canReceiveStandaloneOrder(order, new Set(['payments.receive']), 'orders'), false)
  assert.equal(canReceiveStandaloneOrder(order, new Set(['orders.view']), 'orders'), false)
  assert.equal(canReceiveStandaloneOrder(order, new Set(['orders.history']), 'history'), false)
  assert.equal(canReceiveStandaloneOrder(order, new Set(['orders.view', 'payments.receive']), undefined), false)
  assert.equal(canReceiveStandaloneOrder(order, new Set(['orders.view', 'payments.receive']), 'receivables'), false)
})
