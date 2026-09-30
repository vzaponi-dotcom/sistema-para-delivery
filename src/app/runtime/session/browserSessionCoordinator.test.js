import test from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserSessionCoordinator } from './browserSessionCoordinator.js'

test('same-browser tabs invalidate through opaque events without sharing any private context', () => {
  const listeners = new Set(), messages = []
  const channelFactory = () => {
    const channel = { onmessage: null, postMessage(value) { messages.push(value); for (const other of listeners) if (other !== channel) other.onmessage?.({ data: value }) }, close() { listeners.delete(channel) } }
    listeners.add(channel); return channel
  }
  let refreshA = 0, refreshB = 0
  const a = createBrowserSessionCoordinator({ channelFactory, windowObject: null, onInvalidate: () => refreshA++ })
  const b = createBrowserSessionCoordinator({ channelFactory, windowObject: null, onInvalidate: () => refreshB++ })
  a.publish()
  assert.equal(refreshA, 0); assert.equal(refreshB, 1)
  b.publish()
  assert.equal(refreshA, 1); assert.equal(refreshB, 1)
  assert.deepEqual(Object.keys(messages[0]), ['type', 'id'])
  a.close(); b.publish(); assert.equal(refreshA, 1)
  b.close()
})

test('storage fallback deduplicates a channel event and removes listeners on close', () => {
  const windowObject = new EventTarget()
  windowObject.localStorage = { setItem() { throw new Error('disabled') } }
  let channel, calls = 0
  const coordinator = createBrowserSessionCoordinator({ windowObject, channelFactory: () => (channel = { close() {}, postMessage() {} }), onInvalidate: () => calls++ })
  const message = { type: 'session-change', id: 'opaque' }
  channel.onmessage({ data: message })
  const event = () => Object.assign(new Event('storage'), { key: 'delivery-session-change', newValue: JSON.stringify(message) })
  windowObject.dispatchEvent(event())
  assert.equal(calls, 1)
  assert.doesNotThrow(() => coordinator.publish())
  coordinator.close()
  windowObject.dispatchEvent(Object.assign(new Event('storage'), { key: 'delivery-session-change', newValue: JSON.stringify({ ...message, id: 'next' }) }))
  assert.equal(calls, 1)
})
