import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness } from '../test-support/renderWorkspace.js'
import { deferred } from '../test-support/comandaFixtures.js'
import {
  canConsumeAutomaticPrintJob,
  getPrintingTransportKind,
  getRendererCompatibilityMode,
  isPrintingTransportSupported,
  usePrintingManager,
} from './usePrintingManager.js'

const readyAutomaticConsumer = (overrides = {}) => ({
  authenticated: true,
  isOnline: true,
  supported: true,
  visible: true,
  browserOnline: true,
  busyJobId: null,
  printerBlocked: false,
  transportReady: true,
  station: { isPrimary: true, autoPrintEnabled: true },
  ...overrides,
})

test('Windows uses QZ, Android keeps RawBT, and only fallback platforms depend on Web Serial', () => {
  assert.equal(getPrintingTransportKind('windows'), 'qz')
  assert.equal(getPrintingTransportKind('android'), 'rawbt')
  assert.equal(getPrintingTransportKind('other'), 'web-serial')
  assert.equal(getRendererCompatibilityMode('qz'), 'mpt2-bitmap')
  assert.equal(getRendererCompatibilityMode('rawbt'), 'mpt2-bitmap')
  assert.equal(getRendererCompatibilityMode('web-serial'), null)

  assert.equal(isPrintingTransportSupported('windows', undefined), true)
  assert.equal(isPrintingTransportSupported('android', undefined), true)
  assert.equal(isPrintingTransportSupported('other', undefined), false)
  assert.equal(isPrintingTransportSupported('other', { requestPort() {}, getPorts() {} }), true)
})

test('automatic consumer does not claim while QZ or another local transport is not ready', () => {
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer({ transportReady: false })), false)
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer()), true)
})

test('transport support alone cannot bypass station and local-readiness guards', () => {
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer({
    supported: true,
    transportReady: false,
    station: { isPrimary: true, autoPrintEnabled: true },
  })), false)
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer({
    transportReady: true,
    station: { isPrimary: false, autoPrintEnabled: true },
  })), false)
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer({
    transportReady: true,
    station: { isPrimary: true, autoPrintEnabled: false },
  })), false)
})

test('table-tab preview and printing fetch the canonical endpoint, use one direct transport pass, and never touch queue APIs', async (t) => {
  const h = await workspaceHarness(t)
  const writes = []
  const port = {
    getInfo: () => ({ usbVendorId: 1, usbProductId: 2 }),
    open: async () => {}, close: async () => {},
    writable: { getWriter: () => ({ write: async (bytes) => { writes.push(bytes) }, releaseLock() {} }) },
  }
  globalThis.navigator.serial = { getPorts: async () => [port], requestPort: async () => port }
  const requests = []
  const document = {
    type: 'table-tab', business: { name: 'Restaurante' },
    tableTab: { id: 'tab-42', number: 42, tableName: 'Mesa 7' },
    items: [{ name: 'X-Bacon', presentation: '', note: '', quantity: 1, lineTotalCents: 2500 }],
    financial: { totalCents: 2500 }, message: 'PR\u00c9-CONTA \u2014 N\u00c3O \u00c9 COMPROVANTE DE PAGAMENTO',
  }
  globalThis.fetch = async (path) => {
    requests.push(String(path))
    if (path === '/api/printing/stations') return { ok: true, json: async () => ({ stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false, defaultCopies: 2 }] }) }
    if (String(path).startsWith('/api/printing/jobs?')) return { ok: true, json: async () => ({ jobs: [] }) }
    if (path === '/api/table-tabs/tab-42/print-document') return { ok: true, json: async () => ({ document }) }
    throw new Error(`Unexpected queue mutation: ${path}`)
  }

  function Probe() { return React.createElement('printing-probe', { value: usePrintingManager({ authenticated: true, isOnline: true }) }) }
  const r = await h.render(Probe)
  const currentPrinting = () => r.root.findByType('printing-probe').props.value
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
  assert.equal(await currentPrinting().getTableTabPreviewDocument('tab-42'), document)
  await act(async () => {
    assert.deepEqual(await currentPrinting().printTableTab('tab-42'), { status: 'printed', copiesPrinted: 1 })
  })

  assert.equal(writes.length, 1)
  assert.ok(writes[0] instanceof Uint8Array)
  assert.equal(requests.filter((path) => path === '/api/table-tabs/tab-42/print-document').length, 2)
  assert.equal(requests.some((path) => /\/api\/orders\/.*\/print-jobs|\/claim|\/complete|\/fail/.test(path)), false)
  await act(async () => r.unmount())
})

test('an old-session manual print cannot clear a newer session operation or report its stale error', async (t) => {
  const h = await workspaceHarness(t)
  const writes = [deferred(), deferred()]
  const reported = []
  let writeIndex = 0
  const port = {
    getInfo: () => ({ usbVendorId: 1, usbProductId: 2 }),
    open: async () => {}, close: async () => {},
    writable: { getWriter: () => ({ write: () => writes[writeIndex++].promise, releaseLock() {} }) },
  }
  globalThis.navigator.serial = { getPorts: async () => [port], requestPort: async () => port }
  globalThis.fetch = async (path) => {
    if (path === '/api/printing/stations') return { ok: true, json: async () => ({ stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false, defaultCopies: 2 }] }) }
    if (String(path).startsWith('/api/printing/jobs?')) return { ok: true, json: async () => ({ jobs: [] }) }
    if (String(path).includes('/print-document')) {
      const id = decodeURIComponent(String(path).split('/').at(-2))
      return { ok: true, json: async () => ({ document: { type: 'table-tab', business: { name: 'Loja' }, tableTab: { id, number: 42, tableName: 'Mesa' }, items: [], financial: { totalCents: 0 }, message: '' } }) }
    }
    throw new Error(`Unexpected request: ${path}`)
  }

  const handleError = (error) => reported.push(error.message)
  function Probe({ authenticated }) { return React.createElement('printing-probe', { value: usePrintingManager({ authenticated, isOnline: true, onError: handleError }) }) }
  const r = await h.render(Probe, { authenticated: true })
  const currentPrinting = () => r.root.findByType('printing-probe').props.value
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
  let oldPrint
  await act(async () => { oldPrint = currentPrinting().printTableTab('old'); await Promise.resolve(); await Promise.resolve() })
  const oldOutcome = oldPrint.then(() => null, (error) => error)
  assert.equal(currentPrinting().busyJobId, 'table-tab:old')

  await act(async () => r.update(React.createElement(Probe, { authenticated: false })))
  await act(async () => r.update(React.createElement(Probe, { authenticated: true })))
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
  let currentPrint
  await act(async () => { currentPrint = currentPrinting().printTableTab('current'); await Promise.resolve(); await Promise.resolve() })
  assert.equal(currentPrinting().busyJobId, 'table-tab:current')

  const staleFailure = Object.assign(new Error('falha da sess\u00e3o antiga'), { code: 'SERIAL_WRITE_UNCERTAIN' })
  await act(async () => writes[0].reject(staleFailure))
  const oldError = await oldOutcome
  assert.equal(oldError.code, 'SERIAL_WRITE_UNCERTAIN')
  assert.equal(oldError.cause, staleFailure)
  assert.equal(currentPrinting().busyJobId, 'table-tab:current')
  assert.deepEqual(reported, [])

  await act(async () => writes[1].resolve())
  await currentPrint
  assert.equal(currentPrinting().busyJobId, null)
})
