import test from 'node:test'
import assert from 'node:assert/strict'
import { createMovement, deleteMovement, saveFinanceSettings, updateMovement } from './client.js'

const withFetch = async (callback) => {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (...args) => {
    calls.push(args)
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try { await callback(calls) } finally { globalThis.fetch = original }
}

test('finance client exposes create, update, delete and settings routes', async () => {
  await withFetch(async (calls) => {
    const movement = { type: 'saida', category: 'packaging', description: 'Caixas', value: 25, movementDate: '2026-09-02', paymentMethod: 'Pix' }
    await createMovement(movement)
    await updateMovement('m 1', movement)
    await deleteMovement('m 1')
    await saveFinanceSettings({ openingBalance: -10, openingDate: '2026-09-01' })

    assert.deepEqual(calls.map(([path, options]) => [path, options.method]), [
      ['/api/movements', 'POST'],
      ['/api/movements/m%201', 'PATCH'],
      ['/api/movements/m%201', 'DELETE'],
      ['/api/finance-settings', 'PUT'],
    ])
    assert.deepEqual(JSON.parse(calls[1][1].body), movement)
    assert.deepEqual(JSON.parse(calls[3][1].body), { openingBalance: -10, openingDate: '2026-09-01' })
  })
})
