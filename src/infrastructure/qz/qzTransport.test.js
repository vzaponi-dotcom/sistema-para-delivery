import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createQzTransport } from './qzTransport.js'

class MapStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

const fakeQzApi = (calls) => ({
  security: {
    setCertificatePromise(callback) { calls.push(['certificate-callback', typeof callback]) },
    setSignatureAlgorithm(value) { calls.push(['signature-algorithm', value]) },
    setSignaturePromise(callback) { calls.push(['signature-callback', typeof callback]) },
  },
  websocket: {
    active: false,
    isActive() { return this.active },
    async connect() { calls.push(['connect']); this.active = true },
    setClosedCallbacks(callbacks) { calls.push(['closed-callbacks', callbacks.length]) },
  },
  printers: {
    async find() { calls.push(['find']); return ['MPT-II'] },
    setPrinterCallbacks() {},
    async startListening() {},
    async stopListening() {},
    async getStatus() { return [] },
  },
  configs: {
    create(printer, options) { calls.push(['config', printer, options]); return { printer, options } },
  },
  async print(_config, data) { calls.push(['print', data]) },
})

test('qz transport hides qz-tray behind one injected adapter', async () => {
  const calls = []
  const storage = new MapStorage()
  const transport = createQzTransport({
    qzApi: fakeQzApi(calls),
    getCertificate: async () => 'CERT',
    signPayload: async () => 'SIGNATURE',
    storage,
  })

  assert.equal(transport.kind, 'qz')
  transport.configureSecurity()
  await transport.connect()
  assert.equal(transport.isConnected(), true)
  assert.deepEqual(await transport.listPrinters(), ['MPT-II'])
  assert.equal(await transport.resolvePrinter('MPT-II'), 'MPT-II')
  assert.equal(transport.readPrinterName('station-1'), null)
  assert.equal(transport.savePrinterName('station-1', ' MPT-II '), 'MPT-II')
  assert.equal(transport.readPrinterName('station-1'), 'MPT-II')
  transport.clearPrinterName('station-1')
  assert.equal(transport.readPrinterName('station-1'), null)
})

test('new QZ infrastructure has one concrete qz-tray package owner', async () => {
  const source = await readFile(new URL('./qzTransport.js', import.meta.url), 'utf8')
  assert.match(source, /from ['"]qz-tray['"]/)
  assert.doesNotMatch(source, /orders|table-tab|copiesRequested|recoveryState|capabilit/i)
})
