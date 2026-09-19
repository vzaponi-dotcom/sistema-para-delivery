import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearQzPrinterName,
  detectPrintStationPlatform,
  getOrCreateLocalPrintStationId,
  getQzPrinterName,
  saveQzPrinterName,
} from './localPrintStation.js'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

test('local station id is generated once and reused from browser storage', () => {
  const storage = new MemoryStorage()
  let sequence = 0
  const randomUUID = () => `station-${++sequence}`
  assert.equal(getOrCreateLocalPrintStationId(storage, randomUUID), 'station-1')
  assert.equal(getOrCreateLocalPrintStationId(storage, randomUUID), 'station-1')
  assert.equal(sequence, 1)
})

test('station platform detection remains browser-specific and deterministic', () => {
  assert.equal(detectPrintStationPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'windows')
  assert.equal(detectPrintStationPlatform('Mozilla/5.0 (Linux; Android 15; Pixel 8)'), 'android')
  assert.equal(detectPrintStationPlatform('Mozilla/5.0 (X11; Linux x86_64)'), 'other')
  assert.equal(detectPrintStationPlatform('Mozilla/5.0 (Windows NT 10.0; Android compatibility token)'), 'android')
})

test('QZ printer name is trimmed and scoped by station id', () => {
  const storage = new MemoryStorage()
  assert.equal(saveQzPrinterName(storage, 'station-a', '  MPT-II  '), 'MPT-II')
  assert.equal(getQzPrinterName(storage, 'station-a'), 'MPT-II')
  assert.equal(getQzPrinterName(storage, 'station-b'), null)
})

test('blank QZ printer name is not persisted and clear removes it', () => {
  const storage = new MemoryStorage()
  assert.equal(saveQzPrinterName(storage, 'station-a', '   '), '')
  assert.equal(getQzPrinterName(storage, 'station-a'), null)
  saveQzPrinterName(storage, 'station-a', 'MPT-II')
  clearQzPrinterName(storage, 'station-a')
  assert.equal(getQzPrinterName(storage, 'station-a'), null)
})
