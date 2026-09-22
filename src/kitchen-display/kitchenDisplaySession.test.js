import test from 'node:test'
import assert from 'node:assert/strict'

import { bootstrapKitchenDisplay } from './kitchenDisplaySession.js'

const unauthorized = () => Object.assign(new Error('unauthorized'), { status: 401 })
const expired = () => Object.assign(new Error('expired'), { status: 410 })

test('paired TV reads its restricted state without creating a new pairing request', async () => {
  let pairingCalls = 0
  const result = await bootstrapKitchenDisplay({
    readState: async () => ({ orders: [{ id: 'one' }] }),
    readPairingStatus: async () => { pairingCalls += 1 },
    createPairingRequest: async () => { pairingCalls += 1 },
  })
  assert.equal(result.kind, 'paired')
  assert.equal(result.state.orders[0].id, 'one')
  assert.equal(pairingCalls, 0)
})

test('unpaired TV resumes an existing request from its temporary cookie', async () => {
  let created = 0
  const result = await bootstrapKitchenDisplay({
    readState: async () => { throw unauthorized() },
    readPairingStatus: async () => ({ paired: false, code: '482731', expiresAt: '2026-09-22T20:30:00.000Z' }),
    createPairingRequest: async () => { created += 1 },
  })
  assert.deepEqual(result, { kind: 'pairing', pairing: { paired: false, code: '482731', expiresAt: '2026-09-22T20:30:00.000Z' } })
  assert.equal(created, 0)
})

test('unpaired TV creates a fresh code when no valid temporary request exists', async () => {
  const result = await bootstrapKitchenDisplay({
    readState: async () => { throw unauthorized() },
    readPairingStatus: async () => { throw expired() },
    createPairingRequest: async () => ({ paired: false, code: '123456', expiresAt: '2026-09-22T20:30:00.000Z' }),
  })
  assert.equal(result.kind, 'pairing')
  assert.equal(result.pairing.code, '123456')
})

test('transient state failures do not silently create pairing requests', async () => {
  await assert.rejects(() => bootstrapKitchenDisplay({
    readState: async () => { throw Object.assign(new Error('offline'), { status: 503 }) },
    readPairingStatus: async () => assert.fail('must not inspect pairing on transient state failure'),
    createPairingRequest: async () => assert.fail('must not create pairing on transient state failure'),
  }), /offline/)
})
