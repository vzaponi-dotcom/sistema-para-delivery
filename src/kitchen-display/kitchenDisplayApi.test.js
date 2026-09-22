import test from 'node:test'
import assert from 'node:assert/strict'

import { KitchenDisplayHttpError, pairKitchenDisplay, readKitchenDisplayState } from './kitchenDisplayApi.js'

test('pairing and state use only the narrow same-origin API with credentials', async () => {
  const calls = []
  const fetchImpl = async (path, init) => {
    calls.push({ path, init })
    return new Response(JSON.stringify(path.endsWith('/pair') ? { paired: true } : { orders: [], timing: {}, serverNow: '2026-09-22T20:00:00.000Z' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  await pairKitchenDisplay('secret-token', fetchImpl)
  await readKitchenDisplayState(fetchImpl)

  assert.deepEqual(calls.map(({ path }) => path), ['/api/kitchen-tv/pair', '/api/kitchen-tv/state'])
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.credentials, 'same-origin')
  assert.equal(calls[0].init.body, JSON.stringify({ token: 'secret-token' }))
  assert.equal(calls[1].init.credentials, 'same-origin')
  assert.equal(calls.some(({ path }) => path === '/api/bootstrap'), false)
})

test('HTTP errors retain status and distinguish definitive authorization failures', async () => {
  await assert.rejects(
    () => readKitchenDisplayState(async () => new Response('{}', { status: 403 })),
    (error) => error instanceof KitchenDisplayHttpError && error.status === 403 && error.definitive === true,
  )
  await assert.rejects(
    () => readKitchenDisplayState(async () => new Response('{}', { status: 503 })),
    (error) => error instanceof KitchenDisplayHttpError && error.status === 503 && error.definitive === false,
  )
})
