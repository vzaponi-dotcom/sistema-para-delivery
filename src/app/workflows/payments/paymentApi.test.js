import test from 'node:test'
import assert from 'node:assert/strict'
import { createPaymentApi } from './paymentApi.js'

test('paymentApi preserves order and table-tab payment routes', async () => {
  const calls = []
  const api = createPaymentApi({
    request: async (...args) => { calls.push(args); return {} },
    json: (method, body) => ({ method, body: JSON.stringify(body) }),
  })

  await api.registerOrderPayment('o 1', 'Pix')
  await api.registerTableTabPayment('tab 1', 'Dinheiro')

  assert.deepEqual(calls.map(([url, options]) => [url, options.method, JSON.parse(options.body)]), [
    ['/api/orders/o%201/payment', 'POST', { method: 'Pix' }],
    ['/api/table-tabs/tab%201/payment', 'POST', { method: 'Dinheiro' }],
  ])
})
