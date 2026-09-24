import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createKitchenDisplayPairingRequest,
  KitchenDisplayHttpError,
  readKitchenDisplayPairingStatus,
  readKitchenDisplayState,
} from './kitchenDisplayApi.js'

test('pairing request, token-backed status and state stay on the narrow same-origin API', async () => {
  const calls = []
  const fetchImpl = async (path, init) => {
    calls.push({ path, init })
    const payload = path.endsWith('/pairing-request')
      ? { paired: false, code: '482731', expiresAt: '2026-09-22T20:30:00.000Z', requestToken: 'opaque-request-token' }
      : path.endsWith('/pairing-status')
        ? { paired: false, code: '482731', expiresAt: '2026-09-22T20:30:00.000Z' }
        : { orders: [], timing: {}, serverNow: '2026-09-22T20:00:00.000Z' }
    return new Response(JSON.stringify(payload), {
      status: path.endsWith('/pairing-request') ? 201 : 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  const created = await createKitchenDisplayPairingRequest(fetchImpl)
  await readKitchenDisplayPairingStatus(created.requestToken, fetchImpl)
  await readKitchenDisplayState(fetchImpl)

  assert.deepEqual(calls.map(({ path }) => path), [
    '/api/kitchen-tv/pairing-request',
    '/api/kitchen-tv/pairing-status',
    '/api/kitchen-tv/state',
  ])
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[1].init.method, 'POST')
  assert.equal(calls[1].init.body, JSON.stringify({ requestToken: 'opaque-request-token' }))
  assert.equal(calls.every(({ init }) => init.credentials === 'same-origin'), true)
  assert.equal(calls.some(({ path }) => path === '/api/bootstrap'), false)
})

test('pairing status still supports cookie-only fallback when no stored token is available', async () => {
  let init
  await readKitchenDisplayPairingStatus(null, async (_path, options) => {
    init = options
    return new Response(JSON.stringify({ paired: false, code: '123456' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  assert.equal(init.method, 'GET')
  assert.equal(init.credentials, 'same-origin')
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


test('legacy state transport can authenticate with the explicit TV session header', async () => {
  let captured
  await readKitchenDisplayState('legacy-session-token', async (_path, init) => {
    captured = init
    return new Response(JSON.stringify({ orders: [], timing: {}, serverNow: '2026-09-22T20:00:00.000Z' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  assert.equal(captured.headers['x-kitchen-tv-session'], 'legacy-session-token')
  assert.equal(captured.credentials, 'same-origin')
})
