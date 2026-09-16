import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8')

test('App does not own C1 runtime implementation', () => {
  const forbidden = [
    'getSessionApi(',
    'getBootstrapApi(',
    'getOrdersApi(',
    "window.addEventListener('online'",
    'bootstrapSyncInFlightRef',
    'ordersSyncInFlightRef',
    'syncGuardRef = useRef(',
  ]

  for (const token of forbidden) {
    assert.equal(source.includes(token), false, token)
  }
})

test('App retains responsibilities intentionally deferred beyond C1', () => {
  const deferred = [
    'settleAcceptedPayment',
    'handleRegisterTableTabPayment',
    'handleAddClient',
    'handleAddProduct',
    'handleSaveMovement',
    'handleGlobalSecondCopy',
  ]

  for (const token of deferred) {
    assert.equal(source.includes(token), true, token)
  }
})
