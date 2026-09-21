import test from 'node:test'
import assert from 'node:assert/strict'
import { createPaymentApi } from './paymentApi.js'

test('paymentApi sends canonical allocations for standalone order and whole-table payment routes', async () => {
  const calls = []
  const api = createPaymentApi({
    request: async (...args) => { calls.push(args); return {} },
    json: (method, body) => ({ method, body: JSON.stringify(body) }),
  })

  const allocations = [
    { methodCode: 'cash', amountCents: 3000 },
    { methodCode: 'pix', amountCents: 5000 },
  ]
  await api.registerOrderPayment('o 1', allocations)
  await api.registerTableTabPayment('tab 1', allocations)

  assert.deepEqual(calls.map(([url, options]) => [url, options.method, JSON.parse(options.body)]), [
    ['/api/orders/o%201/payment', 'POST', { allocations }],
    ['/api/table-tabs/tab%201/payment', 'POST', { allocations }],
  ])
})
