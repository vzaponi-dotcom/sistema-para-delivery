import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearQzPrinterName,
  getQzPrinterName,
  saveQzPrinterName,
} from './qzLocalPreferences.js'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

test('QZ printer name stays trimmed and scoped by local station id', () => {
  const storage = new MemoryStorage()
  assert.equal(saveQzPrinterName(storage, 'station-a', '  MPT-II  '), 'MPT-II')
  assert.equal(getQzPrinterName(storage, 'station-a'), 'MPT-II')
  assert.equal(getQzPrinterName(storage, 'station-b'), null)
})

test('blank QZ printer name clears the preference and unavailable storage fails closed', () => {
  const storage = new MemoryStorage()
  saveQzPrinterName(storage, 'station-a', 'MPT-II')
  assert.equal(saveQzPrinterName(storage, 'station-a', '   '), '')
  assert.equal(getQzPrinterName(storage, 'station-a'), null)
  saveQzPrinterName(storage, 'station-a', 'MPT-II')
  clearQzPrinterName(storage, 'station-a')
  assert.equal(getQzPrinterName(storage, 'station-a'), null)
  assert.throws(() => saveQzPrinterName({}, 'station-a', 'MPT-II'), { code: 'DEVICE_STORAGE_UNAVAILABLE' })
})
