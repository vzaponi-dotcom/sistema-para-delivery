import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getOrCreateLocalPrintStationId,
  readOriginOrderIds,
  rememberOriginOrderId,
} from './printingLocalPreferences.js'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
}

test('local station id keeps the current delivery-print-station-id key', () => {
  const storage = new MemoryStorage()
  let seq = 0
  assert.equal(getOrCreateLocalPrintStationId(storage, () => `station-${++seq}`), 'station-1')
  assert.equal(getOrCreateLocalPrintStationId(storage, () => `station-${++seq}`), 'station-1')
  assert.equal(storage.getItem('delivery-print-station-id'), 'station-1')
})

test('origin-order ids remain best-effort browser-local state', () => {
  const storage = new MemoryStorage()
  rememberOriginOrderId('order-1', storage)
  rememberOriginOrderId('order-2', storage)
  rememberOriginOrderId('order-1', storage)
  assert.deepEqual([...readOriginOrderIds(storage)].sort(), ['order-1', 'order-2'])

  const broken = {
    getItem() { throw new Error('blocked') },
    setItem() { throw new Error('blocked') },
  }
  assert.deepEqual([...readOriginOrderIds(broken)], [])
  assert.doesNotThrow(() => rememberOriginOrderId('order-3', broken))
})
