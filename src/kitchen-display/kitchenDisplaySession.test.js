import test from 'node:test'
import assert from 'node:assert/strict'

import {
  bootstrapKitchenDisplay,
  KITCHEN_TV_PAIRING_STORAGE_KEY,
  pollKitchenDisplayPairing,
} from './kitchenDisplaySession.js'

const unauthorized = () => Object.assign(new Error('unauthorized'), { status: 401 })
const expired = () => Object.assign(new Error('expired'), { status: 410 })

const storage = () => {
  const data = new Map()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
}

test('paired TV reads its restricted state and clears stale pending pairing storage', async () => {
  const sessionStorage = storage()
  sessionStorage.setItem(KITCHEN_TV_PAIRING_STORAGE_KEY, 'old-request')
  const result = await bootstrapKitchenDisplay({
    storage: sessionStorage,
    readState: async () => ({ orders: [{ id: 'one' }] }),
    readPairingStatus: async () => assert.fail('must not inspect pairing for an authorized TV'),
    createPairingRequest: async () => assert.fail('must not create pairing for an authorized TV'),
  })
  assert.equal(result.kind, 'paired')
  assert.equal(result.state.orders[0].id, 'one')
  assert.equal(sessionStorage.getItem(KITCHEN_TV_PAIRING_STORAGE_KEY), null)
})

test('new pairing request stores only its opaque request token and exposes only code plus expiry to UI', async () => {
  const sessionStorage = storage()
  const result = await bootstrapKitchenDisplay({
    storage: sessionStorage,
    readState: async () => { throw unauthorized() },
    readPairingStatus: async () => { throw expired() },
    createPairingRequest: async () => ({
      paired: false,
      code: '482731',
      expiresAt: '2026-09-22T20:30:00.000Z',
      requestToken: 'opaque-request-token',
    }),
  })

  assert.deepEqual(result, {
    kind: 'pairing',
    pairing: { paired: false, code: '482731', expiresAt: '2026-09-22T20:30:00.000Z' },
  })
  assert.equal(sessionStorage.getItem(KITCHEN_TV_PAIRING_STORAGE_KEY), 'opaque-request-token')
  assert.equal(JSON.stringify(result).includes('opaque-request-token'), false)
})

test('reload reuses the stored request token and therefore keeps the same display code', async () => {
  const sessionStorage = storage()
  sessionStorage.setItem(KITCHEN_TV_PAIRING_STORAGE_KEY, 'stable-request-token')
  const tokens = []
  const result = await bootstrapKitchenDisplay({
    storage: sessionStorage,
    readState: async () => { throw unauthorized() },
    readPairingStatus: async (token) => {
      tokens.push(token)
      return { paired: false, code: '070574', expiresAt: '2026-09-22T20:30:00.000Z' }
    },
    createPairingRequest: async () => assert.fail('reload must not rotate a valid code'),
  })

  assert.deepEqual(tokens, ['stable-request-token'])
  assert.equal(result.pairing.code, '070574')
  assert.equal(sessionStorage.getItem(KITCHEN_TV_PAIRING_STORAGE_KEY), 'stable-request-token')
})

test('polling reuses the same stored token and clears it only after final TV session is confirmed', async () => {
  const sessionStorage = storage()
  sessionStorage.setItem(KITCHEN_TV_PAIRING_STORAGE_KEY, 'stable-request-token')
  const tokens = []
  let paired = false

  const first = await pollKitchenDisplayPairing({
    storage: sessionStorage,
    readPairingStatus: async (token) => {
      tokens.push(token)
      return { paired: false, code: '070574', expiresAt: '2026-09-22T20:30:00.000Z' }
    },
    createPairingRequest: async () => assert.fail('poll must not rotate a valid code'),
    readState: async () => assert.fail('state is not read before approval'),
  })
  assert.equal(first.pairing.code, '070574')
  assert.equal(sessionStorage.getItem(KITCHEN_TV_PAIRING_STORAGE_KEY), 'stable-request-token')

  const second = await pollKitchenDisplayPairing({
    storage: sessionStorage,
    readPairingStatus: async (token) => {
      tokens.push(token)
      paired = true
      return { paired: true }
    },
    createPairingRequest: async () => assert.fail('approved request must not rotate'),
    readState: async () => ({ orders: [] }),
  })
  assert.equal(paired, true)
  assert.equal(second.kind, 'paired')
  assert.deepEqual(tokens, ['stable-request-token', 'stable-request-token'])
  assert.equal(sessionStorage.getItem(KITCHEN_TV_PAIRING_STORAGE_KEY), null)
})

test('expired request is replaced once and the new token becomes the stable request', async () => {
  const sessionStorage = storage()
  sessionStorage.setItem(KITCHEN_TV_PAIRING_STORAGE_KEY, 'expired-request')
  const result = await pollKitchenDisplayPairing({
    storage: sessionStorage,
    readPairingStatus: async (token) => {
      assert.equal(token, 'expired-request')
      throw expired()
    },
    createPairingRequest: async () => ({
      paired: false,
      code: '123456',
      expiresAt: '2026-09-22T21:00:00.000Z',
      requestToken: 'replacement-token',
    }),
  })
  assert.equal(result.pairing.code, '123456')
  assert.equal(sessionStorage.getItem(KITCHEN_TV_PAIRING_STORAGE_KEY), 'replacement-token')
})

test('transient state failures do not create or rotate pairing requests', async () => {
  await assert.rejects(() => bootstrapKitchenDisplay({
    storage: storage(),
    readState: async () => { throw Object.assign(new Error('offline'), { status: 503 }) },
    readPairingStatus: async () => assert.fail('must not inspect pairing on transient state failure'),
    createPairingRequest: async () => assert.fail('must not create pairing on transient state failure'),
  }), /offline/)
})
