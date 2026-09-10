import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness } from '../test-support/renderWorkspace.js'
import { deferred } from '../test-support/comandaFixtures.js'
import {
  PRINT_JOB_POLL_MS,
  canConsumeAutomaticPrintJob,
  getPrintingTransportKind,
  getRendererCompatibilityMode,
  isPrintingTransportSupported,
  usePrintingManager,
} from './usePrintingManager.js'

const flushMicrotasks = async () => {
  for (let index = 0; index < 6; index += 1) await Promise.resolve()
}

const useControlledIntervals = (t, harness) => {
  const originalSetInterval = globalThis.setInterval
  const originalClearInterval = globalThis.clearInterval
  globalThis.setInterval = harness.window.setInterval
  globalThis.clearInterval = harness.window.clearInterval
  t.after(() => {
    globalThis.setInterval = originalSetInterval
    globalThis.clearInterval = originalClearInterval
  })
}

const tableTabDocument = (id = 'tab-42') => ({
  type: 'table-tab',
  business: { name: 'Restaurante' },
  tableTab: { id, number: 42, tableName: 'Mesa 7' },
  items: [{ name: 'X-Bacon', presentation: '', note: '', quantity: 1, lineTotalCents: 2500 }],
  financial: { totalCents: 2500 },
  message: 'PR\u00c9-CONTA \u2014 N\u00c3O \u00c9 COMPROVANTE DE PAGAMENTO',
})

const automaticTestJob = (id = 'automatic-job') => ({
  id,
  document: { type: 'test', business: { name: 'Restaurante' }, test: { title: 'TESTE', message: 'OK' } },
  copiesRequested: 1,
  copiesPrinted: 0,
})

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

test('a pending automatic claim owns printing until completion and blocks manual transport until retry', async (t) => {
  const h = await workspaceHarness(t)
  useControlledIntervals(t, h)
  globalThis.localStorage.setItem('delivery-printer-fingerprint:test-station', JSON.stringify({ usbVendorId: 1, usbProductId: 2 }))
  const pendingClaim = deferred()
  const automaticWrite = deferred()
  const automaticWriteStarted = deferred()
  const automaticCompleted = deferred()
  const automaticCompletionResponse = deferred()
  let activeTransports = 0
  let maximumTransportConcurrency = 0
  let writeCount = 0
  const port = {
    getInfo: () => ({ usbVendorId: 1, usbProductId: 2 }),
    open: async () => {}, close: async () => {},
    writable: { getWriter: () => ({
      write: async () => {
        writeCount += 1
        activeTransports += 1
        maximumTransportConcurrency = Math.max(maximumTransportConcurrency, activeTransports)
        try {
          if (writeCount === 1) {
            automaticWriteStarted.resolve()
            await automaticWrite.promise
          }
        } finally {
          activeTransports -= 1
        }
      },
      releaseLock() {},
    }) },
  }
  globalThis.navigator.serial = { getPorts: async () => [port], requestPort: async () => port }
  const requests = []
  globalThis.fetch = async (path, options) => {
    const url = String(path)
    requests.push({ url, options })
    if (url === '/api/printing/stations') return { ok: true, json: async () => ({ stations: [{ id: 'test-station', platform: 'other', isPrimary: true, autoPrintEnabled: true, defaultCopies: 2 }] }) }
    if (url.startsWith('/api/printing/jobs?')) return { ok: true, json: async () => ({ jobs: [] }) }
    if (url === '/api/printing/jobs/claim-next') return pendingClaim.promise
    if (url === '/api/printing/jobs/automatic-job/complete') {
      automaticCompleted.resolve()
      return automaticCompletionResponse.promise
    }
    if (url === '/api/table-tabs/tab-42/print-document') return { ok: true, json: async () => ({ document: tableTabDocument() }) }
    throw new Error(`Unexpected request: ${url}`)
  }

  function Probe() { return React.createElement('printing-probe', { value: usePrintingManager({ authenticated: true, isOnline: true }) }) }
  const r = await h.render(Probe)
  const currentPrinting = () => r.root.findByType('printing-probe').props.value
  await act(flushMicrotasks)

  await act(async () => { h.fireInterval(PRINT_JOB_POLL_MS); await flushMicrotasks() })
  assert.ok(currentPrinting().busyJobId)
  await assert.rejects(currentPrinting().printTableTab('tab-42'), { code: 'PRINT_BUSY' })
  assert.equal(requests.filter(({ url }) => url === '/api/table-tabs/tab-42/print-document').length, 0)
  assert.equal(writeCount, 0)

  await act(async () => {
    pendingClaim.resolve({ ok: true, json: async () => ({ job: automaticTestJob() }) })
    await automaticWriteStarted.promise
  })
  assert.equal(currentPrinting().busyJobId, 'automatic-job')
  assert.equal(activeTransports, 1)

  await act(async () => {
    automaticWrite.resolve()
    await automaticCompleted.promise
  })
  assert.equal(currentPrinting().busyJobId, 'automatic-job')
  assert.equal(activeTransports, 0)
  await act(async () => {
    automaticCompletionResponse.resolve({ ok: true, json: async () => ({ job: { ...automaticTestJob(), status: 'printed', copiesPrinted: 1 } }) })
    await flushMicrotasks()
  })
  assert.equal(currentPrinting().busyJobId, null)
  assert.equal(activeTransports, 0)

  await act(async () => {
    assert.deepEqual(await currentPrinting().printTableTab('tab-42'), { status: 'printed', copiesPrinted: 1 })
  })
  assert.equal(writeCount, 2)
  assert.equal(maximumTransportConcurrency, 1)
  assert.equal(requests.filter(({ url }) => url === '/api/printing/jobs/claim-next').length, 1)
  assert.equal(requests.filter(({ url }) => url === '/api/printing/jobs/automatic-job/complete').length, 1)
  assert.deepEqual(JSON.parse(requests.find(({ url }) => url === '/api/printing/jobs/automatic-job/complete').options.body), {
    stationId: 'test-station', copiesPrinted: 1,
  })
  assert.equal(requests.some(({ url }) => /\/api\/orders\/.*\/print-jobs|\/fail$/.test(url)), false)
})

test('a pending manual document fetch owns printing so automatic polling waits and resumes after release', async (t) => {
  const h = await workspaceHarness(t)
  useControlledIntervals(t, h)
  globalThis.localStorage.setItem('delivery-printer-fingerprint:test-station', JSON.stringify({ usbVendorId: 1, usbProductId: 2 }))
  const pendingDocument = deferred()
  const manualWrite = deferred()
  const manualWriteStarted = deferred()
  const automaticWrite = deferred()
  const automaticWriteStarted = deferred()
  const automaticCompleted = deferred()
  const automaticCompletionResponse = deferred()
  let activeTransports = 0
  let maximumTransportConcurrency = 0
  let writeCount = 0
  const port = {
    getInfo: () => ({ usbVendorId: 1, usbProductId: 2 }),
    open: async () => {}, close: async () => {},
    writable: { getWriter: () => ({
      write: async () => {
        writeCount += 1
        activeTransports += 1
        maximumTransportConcurrency = Math.max(maximumTransportConcurrency, activeTransports)
        try {
          if (writeCount === 1) {
            manualWriteStarted.resolve()
            await manualWrite.promise
          } else {
            automaticWriteStarted.resolve()
            await automaticWrite.promise
          }
        } finally {
          activeTransports -= 1
        }
      },
      releaseLock() {},
    }) },
  }
  globalThis.navigator.serial = { getPorts: async () => [port], requestPort: async () => port }
  const requests = []
  globalThis.fetch = async (path) => {
    const url = String(path)
    requests.push(url)
    if (url === '/api/printing/stations') return { ok: true, json: async () => ({ stations: [{ id: 'test-station', platform: 'other', isPrimary: true, autoPrintEnabled: true, defaultCopies: 2 }] }) }
    if (url.startsWith('/api/printing/jobs?')) return { ok: true, json: async () => ({ jobs: [] }) }
    if (url === '/api/table-tabs/tab-42/print-document') return pendingDocument.promise
    if (url === '/api/printing/jobs/claim-next') return { ok: true, json: async () => ({ job: automaticTestJob() }) }
    if (url === '/api/printing/jobs/automatic-job/complete') {
      automaticCompleted.resolve()
      return automaticCompletionResponse.promise
    }
    throw new Error(`Unexpected request: ${url}`)
  }

  function Probe() { return React.createElement('printing-probe', { value: usePrintingManager({ authenticated: true, isOnline: true }) }) }
  const r = await h.render(Probe)
  const currentPrinting = () => r.root.findByType('printing-probe').props.value
  await act(flushMicrotasks)

  let manualPrint
  await act(async () => { manualPrint = currentPrinting().printTableTab('tab-42'); await flushMicrotasks() })
  assert.equal(currentPrinting().busyJobId, 'table-tab:tab-42')
  await act(async () => { h.fireInterval(PRINT_JOB_POLL_MS); await flushMicrotasks() })
  assert.equal(requests.filter((url) => url === '/api/printing/jobs/claim-next').length, 0)

  await act(async () => {
    pendingDocument.resolve({ ok: true, json: async () => ({ document: tableTabDocument() }) })
    await manualWriteStarted.promise
  })
  assert.equal(currentPrinting().busyJobId, 'table-tab:tab-42')
  assert.equal(activeTransports, 1)
  await act(async () => { h.fireInterval(PRINT_JOB_POLL_MS); await flushMicrotasks() })
  assert.equal(requests.filter((url) => url === '/api/printing/jobs/claim-next').length, 0)

  await act(async () => { manualWrite.resolve(); await manualPrint })
  assert.equal(currentPrinting().busyJobId, null)
  await act(async () => { h.fireInterval(PRINT_JOB_POLL_MS); await automaticWriteStarted.promise })
  assert.equal(currentPrinting().busyJobId, 'automatic-job')
  assert.equal(activeTransports, 1)

  await act(async () => {
    automaticWrite.resolve()
    await automaticCompleted.promise
  })
  assert.equal(currentPrinting().busyJobId, 'automatic-job')
  assert.equal(activeTransports, 0)
  await act(async () => {
    automaticCompletionResponse.resolve({ ok: true, json: async () => ({ job: { ...automaticTestJob(), status: 'printed', copiesPrinted: 1 } }) })
    await flushMicrotasks()
  })
  assert.equal(currentPrinting().busyJobId, null)
  assert.equal(maximumTransportConcurrency, 1)
  assert.equal(requests.filter((url) => url === '/api/printing/jobs/claim-next').length, 1)
  assert.equal(requests.filter((url) => url === '/api/printing/jobs/automatic-job/complete').length, 1)
  assert.equal(requests.some((url) => /\/api\/orders\/.*\/print-jobs|\/fail$/.test(url)), false)
})
