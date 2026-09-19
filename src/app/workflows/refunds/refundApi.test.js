import test from 'node:test'
import assert from 'node:assert/strict'
import { createRefundApi } from './refundApi.js'

test('refundApi posts the existing refund payload', async () => {
  const calls = []

  const api = createRefundApi({
    request: async (...args) => {
      calls.push(args)
      return { order: {}, movement: {} }
    },
    json: (method, body) => ({
      method,
      body: JSON.stringify(body),
    }),
  })

  await api.refundOrder('o 1', { refundMethod: 'Dinheiro' })

  assert.equal(calls[0][0], '/api/orders/o%201/refund')
  assert.equal(calls[0][1].method, 'POST')
  assert.deepEqual(JSON.parse(calls[0][1].body), { refundMethod: 'Dinheiro' })
})
