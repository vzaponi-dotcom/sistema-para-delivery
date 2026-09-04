import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findAuthorizedPrinterPort,
  getOrCreateLocalPrintStationId,
  getPrinterFingerprint,
  savePrinterFingerprint,
} from './localPrintStation.js'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

const port = (info) => ({ getInfo: () => ({ ...info }) })

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

test('printer fingerprint persists only serial metadata and resolves the matching authorized port', async () => {
  const storage = new MemoryStorage()
  const stationId = 'station-a'
  const printer = port({ bluetoothServiceClassId: '00001101-0000-1000-8000-00805f9b34fb' })
  const other = port({ usbVendorId: 1234, usbProductId: 5678 })

  const fingerprint = savePrinterFingerprint(storage, stationId, printer)
  assert.deepEqual(fingerprint, { bluetoothServiceClassId: '00001101-0000-1000-8000-00805f9b34fb' })
  assert.deepEqual(getPrinterFingerprint(storage, stationId), fingerprint)

  const serial = { getPorts: async () => [other, printer] }
  assert.equal(await findAuthorizedPrinterPort(serial, storage, stationId), printer)
})

test('authorized port discovery uses one-port fallback but refuses ambiguous unmatched ports', async () => {
  const storage = new MemoryStorage()
  const stationId = 'station-a'
  const one = port({ usbVendorId: 111, usbProductId: 222 })
  assert.equal(await findAuthorizedPrinterPort({ getPorts: async () => [one] }, storage, stationId), one)

  const two = port({ usbVendorId: 333, usbProductId: 444 })
  assert.equal(await findAuthorizedPrinterPort({ getPorts: async () => [one, two] }, storage, stationId), null)
})

test('duplicate matching fingerprints are considered ambiguous instead of choosing arbitrarily', async () => {
  const storage = new MemoryStorage()
  const stationId = 'station-a'
  const first = port({ usbVendorId: 111, usbProductId: 222 })
  const second = port({ usbVendorId: 111, usbProductId: 222 })
  savePrinterFingerprint(storage, stationId, first)

  assert.equal(await findAuthorizedPrinterPort({ getPorts: async () => [first, second] }, storage, stationId), null)
})
