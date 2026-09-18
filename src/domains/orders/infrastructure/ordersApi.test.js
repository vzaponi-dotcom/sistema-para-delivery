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
