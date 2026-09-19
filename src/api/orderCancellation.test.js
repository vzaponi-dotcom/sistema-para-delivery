import test from 'node:test'
import assert from 'node:assert/strict'
import { ordersApi } from '../domains/orders/index.js'

const withFetchStub = async (run) => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (path, options = {}) => {
    calls.push({ path, options })
    return new Response(JSON.stringify({ order: { id: 'o1' }, movement: { id: 'm1' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    await run(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

test('cancelOrder posts semantic cancellation payload to encoded order endpoint', async () => {
  await withFetchStub(async (calls) => {
    const payload = { reason: 'entry_error', note: '', refundNow: false, refundMethod: '' }
    await ordersApi.cancelOrder('pedido 1', payload)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].path, '/api/orders/pedido%201/cancel')
    assert.equal(calls[0].options.method, 'POST')
    assert.deepEqual(JSON.parse(calls[0].options.body), payload)
  })
})

