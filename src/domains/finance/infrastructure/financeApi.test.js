import test from 'node:test'
import assert from 'node:assert/strict'
import { createFinanceApi } from './financeApi.js'

test('financeApi preserves current routes and payloads', async () => {
  const calls = []
  const api = createFinanceApi({
    request: async (...args) => { calls.push(args); return {} },
    json: (method, body) => ({ method, body: JSON.stringify(body) }),
  })

  await api.createMovement({ value: 10 })
  await api.updateMovement('m 1', { value: 20 })
  await api.deleteMovement('m 1')
  await api.saveFinanceSettings({ openingBalance: -10, openingDate: '2026-09-01' })

  assert.deepEqual(calls.map(([url, options]) => [url, options.method]), [
    ['/api/movements', 'POST'],
    ['/api/movements/m%201', 'PATCH'],
    ['/api/movements/m%201', 'DELETE'],
    ['/api/finance-settings', 'PUT'],
  ])
  assert.deepEqual(JSON.parse(calls[0][1].body), { value: 10 })
  assert.deepEqual(JSON.parse(calls[1][1].body), { value: 20 })
  assert.deepEqual(JSON.parse(calls[3][1].body), { openingBalance: -10, openingDate: '2026-09-01' })
})
