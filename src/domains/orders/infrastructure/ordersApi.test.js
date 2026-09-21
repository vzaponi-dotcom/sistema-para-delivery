import assert from 'node:assert/strict'
import test from 'node:test'
import { createOrdersApi } from './ordersApi.js'

test('orders api preserves lifecycle routes and idempotency', async () => {
  const calls = []
  const request = async (path, options = {}) => { calls.push([path, options]); return { ok: true } }
  const json = (method, body) => ({ method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
  const api = createOrdersApi({ request, json, randomUUID: () => 'generated-key' })
  await api.getOrders()
  await api.createOrder({ client: 'Ana' })
  await api.updateOrderStatus('order / 1')
  await api.cancelOrder('order / 1', { reasonId: 'r-1' })
  assert.equal(calls[0][0], '/api/orders')
  assert.equal(calls[1][1].headers['idempotency-key'], 'generated-key')
  assert.equal(calls[1][1].headers['content-type'], 'application/json')
  assert.equal(calls[2][0], '/api/orders/order%20%2F%201/status')
  assert.equal(JSON.parse(calls[2][1].body).status, 'Finalizado')
  assert.equal(calls[3][0], '/api/orders/order%20%2F%201/cancel')
})

test('ordersApi owns payment-promise writes', async () => {
  const calls = []
  const api = createOrdersApi({
    request: async (...args) => { calls.push(args); return { order: { id: 'o1' } } },
    json: (method, body) => ({ method, body: JSON.stringify(body) }),
    randomUUID: () => 'unused',
  })

  await api.updatePaymentPromise('o 1', '2026-09-20')

  assert.equal(calls[0][0], '/api/orders/o%201/payment-promise')
  assert.equal(calls[0][1].method, 'PATCH')
  assert.deepEqual(JSON.parse(calls[0][1].body), { promisedPaymentDate: '2026-09-20' })
})

test('orders api preserves an explicit checkout idempotency key and payload', async () => {
  const calls = []
  const api = createOrdersApi({
    request: async (...args) => { calls.push(args); return { order: { id: 'o1' } } },
    json: (method, body) => ({ method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
    randomUUID: () => 'generated-key',
  })
  const payload = {
    clientId: 'c1',
    type: 'Entrega',
    orderDate: '2026-09-01',
    items: [{ productId: 'p1', quantity: 2, note: 'sem cebola' }],
    deliveryFee: 8,
    adjustment: { type: 'discount', mode: 'percentage', value: 10, reason: '' },
    paymentAllocations: [{ methodCode: 'pix', amountCents: 7280 }],
  }

  await api.createOrder(payload, 'checkout-key')

  assert.equal(calls[0][0], '/api/orders')
  assert.equal(calls[0][1].headers['idempotency-key'], 'checkout-key')
  assert.equal(calls[0][1].headers['content-type'], 'application/json')
  assert.deepEqual(JSON.parse(calls[0][1].body), payload)
})
