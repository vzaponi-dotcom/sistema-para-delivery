import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createKitchenDisplayPairingRequest,
  KitchenDisplayHttpError,
  readKitchenDisplayPairingStatus,
  readKitchenDisplayState,
} from './kitchenDisplayApi.js'

test('pairing request, pairing status and state use only the narrow same-origin API with credentials', async () => {
  const calls = []
  const fetchImpl = async (path, init) => {
    calls.push({ path, init })
    const payload = path.endsWith('/pairing-request')
      ? { paired: false, code: '482731', expiresAt: '2026-09-22T20:30:00.000Z' }
      : path.endsWith('/pairing-status')
        ? { paired: false, code: '482731', expiresAt: '2026-09-22T20:30:00.000Z' }
        : { orders: [], timing: {}, serverNow: '2026-09-22T20:00:00.000Z' }
    return new Response(JSON.stringify(payload), {
      status: path.endsWith('/pairing-request') ? 201 : 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  await createKitchenDisplayPairingRequest(fetchImpl)
  await readKitchenDisplayPairingStatus(fetchImpl)
  await readKitchenDisplayState(fetchImpl)

  assert.deepEqual(calls.map(({ path }) => path), [
    '/api/kitchen-tv/pairing-request',
    '/api/kitchen-tv/pairing-status',
    '/api/kitchen-tv/state',
  ])
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls.every(({ init }) => init.credentials === 'same-origin'), true)
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
