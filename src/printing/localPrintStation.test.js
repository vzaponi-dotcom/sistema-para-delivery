import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearQzPrinterName,
  detectPrintStationPlatform,
  getDefaultPrintStationName,
  getOrCreateLocalPrintStationId,
  getQzPrinterName,
  isQzPrintStationEligible,
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

  const first = getOrCreateLocalPrintStationId(storage, randomUUID)
  const second = getOrCreateLocalPrintStationId(storage, randomUUID)

  assert.equal(first, 'station-1')
  assert.equal(second, 'station-1')
  assert.equal(sequence, 1)
})

test('station platform detection and default names are deterministic for Windows Android and other', () => {
  assert.equal(detectPrintStationPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'windows')
  assert.equal(detectPrintStationPlatform('Mozilla/5.0 (Linux; Android 15; Pixel 8)'), 'android')
  assert.equal(detectPrintStationPlatform('Mozilla/5.0 (X11; Linux x86_64)'), 'other')
  assert.equal(detectPrintStationPlatform('Mozilla/5.0 (Windows NT 10.0; Android compatibility token)'), 'android')

  assert.equal(getDefaultPrintStationName('windows'), 'Cozinha · Windows')
  assert.equal(getDefaultPrintStationName('android'), 'Cozinha · Android')
  assert.equal(getDefaultPrintStationName('other'), 'Cozinha · Navegador')
  assert.equal(getDefaultPrintStationName('unexpected'), 'Cozinha · Navegador')
})

test('only Windows with an explicitly configured QZ printer is locally eligible for physical execution', () => {
  assert.equal(typeof isQzPrintStationEligible, 'function')
  assert.equal(isQzPrintStationEligible({ platform: 'windows', qzPrinterName: 'MPT-II' }), true)
  assert.equal(isQzPrintStationEligible({ platform: 'windows', qzPrinterName: '  Impressora pedido  ' }), true)
  assert.equal(isQzPrintStationEligible({ platform: 'windows', qzPrinterName: '' }), false)
  assert.equal(isQzPrintStationEligible({ platform: 'android', qzPrinterName: 'MPT-II' }), false)
  assert.equal(isQzPrintStationEligible({ platform: 'other', qzPrinterName: 'MPT-II' }), false)
})

test('QZ printer name is trimmed and scoped by local station id', () => {
  const storage = new MemoryStorage()

  assert.equal(saveQzPrinterName(storage, 'station-a', '  MPT-II  '), 'MPT-II')
  assert.equal(getQzPrinterName(storage, 'station-a'), 'MPT-II')
  assert.equal(getQzPrinterName(storage, 'station-b'), null)
})

test('blank QZ printer name is not persisted and clear removes the saved queue', () => {
  const storage = new MemoryStorage()

  assert.equal(saveQzPrinterName(storage, 'station-a', '   '), '')
  assert.equal(getQzPrinterName(storage, 'station-a'), null)

  saveQzPrinterName(storage, 'station-a', 'MPT-II')
  clearQzPrinterName(storage, 'station-a')
  assert.equal(getQzPrinterName(storage, 'station-a'), null)
})
