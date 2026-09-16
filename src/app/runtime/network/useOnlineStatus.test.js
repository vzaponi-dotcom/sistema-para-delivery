import test from 'node:test'
import assert from 'node:assert/strict'
import { readOnlineStatus, subscribeOnlineStatus } from './useOnlineStatus.js'

test('readOnlineStatus preserves current navigator semantics', () => {
  assert.equal(readOnlineStatus(undefined), true)
  assert.equal(readOnlineStatus({ onLine: false }), false)
  assert.equal(readOnlineStatus({ onLine: true }), true)
})

test('subscribeOnlineStatus publishes online/offline and removes both listeners', () => {
  const listeners = new Map()
  const removed = []
  const fakeWindow = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => removed.push([name, fn]),
  }
  const values = []
  const unsubscribe = subscribeOnlineStatus(fakeWindow, (value) => values.push(value))
  listeners.get('online')()
  listeners.get('offline')()
  unsubscribe()
  assert.deepEqual(values, [true, false])
  assert.equal(removed.length, 2)
})
