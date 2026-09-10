import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { act } from 'react-test-renderer'
import qz from 'qz-tray'
import { workspaceHarness } from '../test-support/renderWorkspace.js'
import { deferred } from '../test-support/comandaFixtures.js'
import {
  PRINT_JOB_POLL_MS,
  canExecuteSecondCopy,
  canInitializeBackgroundPhysicalTransport,
  canKeepSecondCopyPromptOpen,
  canPresentSecondCopyPrompt,
  canConsumeAutomaticPrintJob,
  claimAndExecuteSecondCopy,
  createPhysicalJobFailureNotifier,
  getPrintingTransportKind,
  getRendererCompatibilityMode,
  initializeBackgroundPhysicalTransport,
  isPrintingTransportSupported,
  usePrintingManager,
} from './usePrintingManager.js'
import { runClaimedPrintJob } from './printJobRunner.js'

const managerSource = await readFile(new URL('./usePrintingManager.js', import.meta.url), 'utf8')

const awaitingSecondCopyJob = {
  status: 'awaiting_second_copy',
  copiesRequested: 2,
  copiesPrinted: 1,
}

const flushMicrotasks = async () => {
  for (let index = 0; index < 20; index += 1) await Promise.resolve()
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

const useFakeQz = (t, harness) => {
  const original = {
    websocket: { ...qz.websocket }, printers: { ...qz.printers }, configs: { ...qz.configs },
    security: { ...qz.security }, print: qz.print,
  }
  let printerCallback = null
  Object.assign(qz.websocket, { isActive: () => true, connect: async () => {}, setClosedCallbacks: () => {} })
  Object.assign(qz.printers, {
    find: async () => ['MPT-II'],
    setPrinterCallbacks: (callback) => { printerCallback = callback },
    startListening: async () => {}, stopListening: async () => {},
    getStatus: async () => ({ printerName: 'MPT-II', eventType: 'PRINTER', statusText: 'OK' }),
  })
  Object.assign(qz.configs, { create: (printerName, options = {}) => ({ printerName, ...options }) })
  Object.assign(qz.security, {
    setCertificatePromise: () => {}, setSignaturePromise: () => {}, setSignatureAlgorithm: () => {},
  })
  qz.print = async (config, payload) => {
    const bytes = Uint8Array.from(atob(payload[0].data), (character) => character.charCodeAt(0))
    const [port] = await globalThis.navigator.serial.getPorts()
    const writer = port.writable.getWriter()
    try { await writer.write(bytes) } finally { writer.releaseLock() }
    if (config.jobName) printerCallback?.({
      printerName: config.printerName, eventType: 'JOB', statusText: 'COMPLETE',
      jobName: config.jobName, jobId: 1,
    })
  }
  harness.window.localStorage.setItem('delivery-qz-printer-name:test-station', 'MPT-II')
  t.after(() => {
    Object.assign(qz.websocket, original.websocket)
    Object.assign(qz.printers, original.printers)
    Object.assign(qz.configs, original.configs)
    Object.assign(qz.security, original.security)
    qz.print = original.print
  })
}

const tableTabDocument = () => ({
  type: 'table-tab',
  business: { name: 'Restaurante' },
  tableTab: { id: 'tab-42', number: 42, tableName: 'Mesa 7' },
  items: [{ name: 'X-Bacon', presentation: '', note: '', quantity: 1, lineTotalCents: 2500 }],
  financial: { totalCents: 2500 },
  message: 'PR\u00c9-CONTA \u2014 N\u00c3O \u00c9 COMPROVANTE DE PAGAMENTO',
})

const automaticTestJob = () => ({
  id: 'automatic-job',
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

test('only Windows uses a physical QZ transport; Android and other platforms are queue-only', () => {
  assert.equal(getPrintingTransportKind('windows'), 'qz')
  assert.equal(getPrintingTransportKind('android'), 'queue-only')
  assert.equal(getPrintingTransportKind('other'), 'queue-only')
  assert.equal(getRendererCompatibilityMode('qz'), 'mpt2-bitmap')
  assert.equal(getRendererCompatibilityMode('queue-only'), null)
  assert.equal(getRendererCompatibilityMode('queue-only'), null)

  assert.equal(isPrintingTransportSupported('windows', undefined), true)
  assert.equal(isPrintingTransportSupported('android', undefined), false)
  assert.equal(isPrintingTransportSupported('other', undefined), false)
  assert.equal(isPrintingTransportSupported('other', { requestPort() {}, getPorts() {} }), false)
})

test('automatic consumer does not claim while QZ or another local transport is not ready', () => {
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer({ transportReady: false })), false)
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer({ qzConnected: false })), false)
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer()), true)
})

test('a non-normal recovery state pauses the normal consumer while the manager uses the dedicated one-copy recovery APIs', () => {
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer({ station: { isPrimary: true, autoPrintEnabled: true, recoveryState: 'pending' } })), false)
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer({ station: { isPrimary: true, autoPrintEnabled: true, recoveryState: 'active' } })), false)
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer({ station: { isPrimary: true, autoPrintEnabled: true, recoveryState: 'deferred' } })), false)
  assert.match(managerSource, /claimNextRecoveryPrintJob/)
  assert.match(managerSource, /setPrintStationRecovery/)
  assert.match(managerSource, /discardPendingPrintJobs/)
  assert.match(managerSource, /resolvePrintOutcome/)
  assert.match(managerSource, /startRecovery/)
  assert.match(managerSource, /printNextRecovery/)
})

test('manager installs spooler monitoring before QZ jobs and routes QZ execution through persisted attempts', () => {
  assert.match(managerSource, /createQzStatusMonitor/)
  assert.match(managerSource, /executeQzPrintAttempt|qzAttempt/)
  assert.match(managerSource, /createPrintAttempt/)
  assert.match(managerSource, /markPrintAttemptSubmitting/)
  assert.match(managerSource, /recordPrintAttemptEvent/)
  assert.match(managerSource, /onJobStatus/)
  assert.match(managerSource, /qzAttemptByNameRef/)
  assert.match(managerSource, /physicalReady: printerHealthRef\.current\.state === 'ready'/)
  assert.match(managerSource, /station\?\.recoveryState/)
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

test('QZ close invalidates readiness and heartbeat responses cannot overwrite newer state', () => {
  assert.match(managerSource, /setClosedCallbacks/)
  assert.match(managerSource, /qzReadinessRef\.current\.invalidate\(\)/)
  assert.match(managerSource, /const heartbeatSequenceRef = useRef\(0\)/)
  assert.match(managerSource, /heartbeatInFlightRef\.current/)
  assert.match(managerSource, /sequence === heartbeatSequenceRef\.current/)
})

test('the primary QZ station can execute an awaiting second copy', () => {
  assert.equal(canExecuteSecondCopy({
    isQz: true,
    station: { isPrimary: true, platform: 'windows' },
    job: awaitingSecondCopyJob,
  }), true)
})

test('non-QZ and secondary stations cannot execute an awaiting second copy', () => {
  assert.equal(canExecuteSecondCopy({
    isQz: false,
    station: { isPrimary: true, platform: 'android' },
    job: awaitingSecondCopyJob,
  }), false)
  assert.equal(canExecuteSecondCopy({
    isQz: true,
    station: { isPrimary: false, platform: 'windows' },
    job: awaitingSecondCopyJob,
  }), false)
})

test('only an unacknowledged awaiting copy can present the second-copy prompt on primary QZ', () => {
  const primaryQz = { isQz: true, transportReady: true, printerBlocked: false, station: { isPrimary: true, platform: 'windows' } }

  assert.equal(canPresentSecondCopyPrompt({ ...primaryQz, job: awaitingSecondCopyJob }), true)
  assert.equal(canPresentSecondCopyPrompt({
    ...primaryQz,
    job: { ...awaitingSecondCopyJob, secondCopyPromptedAt: '2026-09-08T12:00:00.000Z' },
  }), false)
  assert.equal(canPresentSecondCopyPrompt({
    isQz: true,
    transportReady: true,
    printerBlocked: false,
    station: { isPrimary: false, platform: 'windows' },
    job: awaitingSecondCopyJob,
  }), false)
})

test('an unready or blocked primary QZ station cannot present the physical second-copy prompt', () => {
  const station = { isPrimary: true, platform: 'windows' }

  assert.equal(canPresentSecondCopyPrompt({
    isQz: true,
    transportReady: false,
    printerBlocked: false,
    station,
    job: awaitingSecondCopyJob,
  }), false)
  assert.equal(canPresentSecondCopyPrompt({
    isQz: true,
    transportReady: true,
    printerBlocked: true,
    station,
    job: awaitingSecondCopyJob,
  }), false)
})

test('offline kitchens and requester stations never initialize a background transport or become automatic consumers', async () => {
  const calls = []
  const initializeQz = async () => { calls.push('qz') }
  const primary = { id: 'kitchen-primary', isPrimary: true, platform: 'windows', autoPrintEnabled: true }
  const secondary = { id: 'requester-secondary', isPrimary: false, platform: 'windows', autoPrintEnabled: true }

  assert.equal(canInitializeBackgroundPhysicalTransport({ authenticated: true, isOnline: false, isQz: true, station: primary }), false)
  assert.equal(await initializeBackgroundPhysicalTransport({ authenticated: true, isOnline: false, isQz: true, station: primary, initializeQz }), false)
  assert.equal(await initializeBackgroundPhysicalTransport({ authenticated: true, isOnline: true, isQz: true, station: secondary, initializeQz }), false)
  assert.equal(await initializeBackgroundPhysicalTransport({ authenticated: true, isOnline: true, isQz: false, station: primary, initializeQz }), false)
  assert.deepEqual(calls, [])
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer({ isOnline: false, station: primary })), false)
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer({ station: secondary })), false)
})

test('only the online primary Windows QZ station initializes its background transport', async () => {
  const calls = []
  const station = { id: 'kitchen-primary', isPrimary: true, platform: 'windows' }

  assert.equal(await initializeBackgroundPhysicalTransport({
    authenticated: true,
    isOnline: true,
    isQz: true,
    station,
    initializeQz: async (stationId) => { calls.push(stationId) },
  }), true)
  assert.deepEqual(calls, ['kitchen-primary'])
})

test('an open physical second-copy prompt loses eligibility with readiness, block, or primary changes', () => {
  const eligible = {
    isQz: true,
    transportReady: true,
    printerBlocked: false,
    station: { isPrimary: true, platform: 'windows' },
    job: awaitingSecondCopyJob,
  }

  assert.equal(canKeepSecondCopyPromptOpen(eligible), true)
  assert.equal(canKeepSecondCopyPromptOpen({ ...eligible, transportReady: false }), false)
  assert.equal(canKeepSecondCopyPromptOpen({ ...eligible, printerBlocked: true }), false)
  assert.equal(canKeepSecondCopyPromptOpen({ ...eligible, station: { ...eligible.station, isPrimary: false } }), false)
})

test('second-copy preflight failure happens after claim and persists through the claimed-job failure contract', async () => {
  const sequence = []
  let failedPayload = null
  const station = { id: 'kitchen-primary', isPrimary: true, platform: 'windows' }
  const job = { ...awaitingSecondCopyJob, id: 'job-second-copy', document: { version: 1, type: 'order' } }

  const result = await claimAndExecuteSecondCopy({
    isQz: true,
    transportReady: true,
    printerBlocked: false,
    station,
    job,
    claimJob: async (jobId, stationId) => {
      sequence.push(`claim:${jobId}:${stationId}`)
      return { job }
    },
    executeJob: (claimedJob) => {
      sequence.push(`execute:${claimedJob.id}`)
      return runClaimedPrintJob({
        job: claimedJob,
        stationId: station.id,
        port: null,
        completeJob: async () => assert.fail('preflight failure must not complete the job'),
        failJob: async (_jobId, _stationId, payload) => {
          sequence.push('fail')
          failedPayload = payload
        },
        renderer: () => new Uint8Array([1]),
        transport: async () => {
          sequence.push('preflight')
          throw Object.assign(new Error('QZ indisponível.'), { code: 'QZ_CONNECTION_FAILED' })
        },
      })
    },
  })

  assert.equal(result.status, 'requires_attention')
  assert.deepEqual(sequence, ['claim:job-second-copy:kitchen-primary', 'execute:job-second-copy', 'preflight', 'fail'])
  assert.deepEqual(failedPayload, { code: 'QZ_CONNECTION_FAILED', message: 'QZ indisponível.', uncertain: false })
})

test('physical job failure notifications are deduplicated by job and persisted state', () => {
  const notifier = createPhysicalJobFailureNotifier()
  const toasts = []
  const onNotify = (_error, context) => { toasts.push(context) }
  const known = { job: { id: 'known-job' }, status: 'failed', error: new Error('known') }
  const uncertain = { job: { id: 'uncertain-job' }, status: 'requires_attention', error: new Error('uncertain') }

  assert.equal(notifier.notify({ ...known, onNotify }), true)
  assert.equal(notifier.notify({ ...known, onNotify }), false)
  assert.equal(notifier.notify({ ...uncertain, onNotify }), true)
  assert.equal(notifier.notify({ job: { id: 'background' }, status: 'disconnected', error: new Error('poll'), onNotify }), false)
  assert.deepEqual(toasts, [
    { jobId: 'known-job', status: 'failed' },
    { jobId: 'uncertain-job', status: 'requires_attention' },
  ])

  notifier.synchronize([{ id: 'known-job', status: 'pending' }, { id: 'uncertain-job', status: 'requires_attention' }])
  assert.equal(notifier.notify({ ...known, onNotify }), true)
  assert.equal(notifier.notify({ ...uncertain, onNotify }), false)
})

test('the physical-failure notifier has one stable hook-owned instance without reading a ref during render', () => {
  assert.match(managerSource, /useState\(createPhysicalJobFailureNotifier\)/)
  assert.doesNotMatch(managerSource, /physicalJobFailureNotifierRef\.current/)
})

test('second-copy prompt acknowledgement revalidates readiness and block at the manager boundary', () => {
  const start = managerSource.indexOf('const acknowledgeSecondCopyPrompt = useCallback')
  const end = managerSource.indexOf('const retryJob = useCallback', start)
  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  const acknowledgement = managerSource.slice(start, end)

  assert.match(acknowledgement, /canPresentSecondCopyPrompt\(\{[\s\S]*transportReady: transportReadyRef\.current[\s\S]*printerBlocked: printerBlockedRef\.current/)
})

test('table-tab preview and printing fetch the canonical endpoint, use one direct transport pass, and never touch queue APIs', async (t) => {
  const h = await workspaceHarness(t, { userAgent: 'Windows' })
  useFakeQz(t, h)
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
    if (path === '/api/printing/stations') return { ok: true, json: async () => ({ stations: [{ id: 'test-station', platform: 'windows', isPrimary: false, autoPrintEnabled: false, defaultCopies: 2 }] }) }
    if (String(path).startsWith('/api/printing/jobs?')) return { ok: true, json: async () => ({ jobs: [] }) }
    if (path === '/api/printing/jobs/summary') return { ok: true, json: async () => ({ summary: { safeBacklog: 0 } }) }
    if (path === '/api/table-tabs/tab-42/print-document') return { ok: true, json: async () => ({ document }) }
    throw new Error(`Unexpected queue mutation: ${path}`)
  }

  function Probe() { return React.createElement('printing-probe', { value: usePrintingManager({ authenticated: true, isOnline: true }) }) }
  const r = await h.render(Probe)
  const currentPrinting = () => r.root.findByType('printing-probe').props.value
  await act(flushMicrotasks)
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
  const h = await workspaceHarness(t, { userAgent: 'Windows' })
  useFakeQz(t, h)
  const writes = [deferred(), deferred()]
  const writeStarted = [deferred(), deferred()]
  const reported = []
  let writeIndex = 0
  const port = {
    getInfo: () => ({ usbVendorId: 1, usbProductId: 2 }),
    open: async () => {}, close: async () => {},
    writable: { getWriter: () => ({
      write: () => {
        const index = writeIndex++
        writeStarted[index].resolve()
        return writes[index].promise
      },
      releaseLock() {},
    }) },
  }
  globalThis.navigator.serial = { getPorts: async () => [port], requestPort: async () => port }
  globalThis.fetch = async (path) => {
    if (path === '/api/printing/stations') return { ok: true, json: async () => ({ stations: [{ id: 'test-station', platform: 'windows', isPrimary: false, autoPrintEnabled: false, defaultCopies: 2 }] }) }
    if (String(path).startsWith('/api/printing/jobs?')) return { ok: true, json: async () => ({ jobs: [] }) }
    if (path === '/api/printing/jobs/summary') return { ok: true, json: async () => ({ summary: { safeBacklog: 0 } }) }
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
  await act(flushMicrotasks)
  let oldPrint
  await act(async () => { oldPrint = currentPrinting().printTableTab('old'); await writeStarted[0].promise })
  const oldOutcome = oldPrint.then(() => null, (error) => error)
  assert.equal(currentPrinting().busyJobId, 'table-tab:old')

  await act(async () => r.update(React.createElement(Probe, { authenticated: false })))
  await act(async () => r.update(React.createElement(Probe, { authenticated: true })))
  await act(flushMicrotasks)
  await act(async () => { await currentPrinting().selectPrinter('MPT-II') })
  let currentPrint
  await act(async () => { currentPrint = currentPrinting().printTableTab('current'); await writeStarted[1].promise })
  assert.equal(currentPrinting().busyJobId, 'table-tab:current')

  const staleFailure = Object.assign(new Error('falha da sess\u00e3o antiga'), { code: 'SERIAL_WRITE_UNCERTAIN' })
  await act(async () => writes[0].reject(staleFailure))
  const oldError = await oldOutcome
  assert.equal(oldError, staleFailure)
  assert.equal(currentPrinting().busyJobId, 'table-tab:current')
  assert.deepEqual(reported, [])

  await act(async () => writes[1].resolve())
  await currentPrint
  assert.equal(currentPrinting().busyJobId, null)
})

test('a deferred automatic claim blocks manual comanda printing until automatic execution releases', async (t) => {
  const h = await workspaceHarness(t, { userAgent: 'Windows' })
  useFakeQz(t, h)
  useControlledIntervals(t, h)
  globalThis.localStorage.setItem('delivery-printer-fingerprint:test-station', JSON.stringify({ usbVendorId: 1, usbProductId: 2 }))
  const pendingClaim = deferred()
  const automaticWrite = deferred()
  const automaticWriteStarted = deferred()
  t.after(() => {
    pendingClaim.resolve({ ok: true, json: async () => ({ job: null }) })
    automaticWrite.resolve()
  })
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
  globalThis.fetch = async (path) => {
    const url = String(path)
    requests.push(url)
    if (url === '/api/printing/stations') return { ok: true, json: async () => ({ stations: [{ id: 'test-station', platform: 'windows', isPrimary: true, autoPrintEnabled: true, defaultCopies: 2 }] }) }
    if (url.startsWith('/api/printing/jobs?')) return { ok: true, json: async () => ({ jobs: [] }) }
    if (url === '/api/printing/jobs/summary') return { ok: true, json: async () => ({ summary: { safeBacklog: 0 } }) }
    if (url === '/api/printing/stations/test-station/heartbeat') return { ok: true, json: async () => ({ station: { id: 'test-station', platform: 'windows', isPrimary: true, autoPrintEnabled: true, defaultCopies: 2 } }) }
    if (url === '/api/printing/jobs/claim-next') return pendingClaim.promise
    if (url === '/api/printing/jobs/automatic-job/attempts') return { ok: true, json: async () => ({ attempt: { id: 'attempt-1', spoolJobName: 'GESTAO-DELIVERY:automatic-job:COPY:1:ATTEMPT:1' } }) }
    if (url === '/api/printing/attempts/attempt-1/submitting' || url === '/api/printing/attempts/attempt-1/events') return { ok: true, json: async () => ({ attempt: { id: 'attempt-1', spoolJobName: 'GESTAO-DELIVERY:automatic-job:COPY:1:ATTEMPT:1' } }) }
    if (url === '/api/printing/jobs/automatic-job/complete') return { ok: true, json: async () => ({ job: { ...automaticTestJob(), status: 'printed', copiesPrinted: 1 } }) }
    if (url === '/api/table-tabs/tab-42/print-document') return { ok: true, json: async () => ({ document: tableTabDocument() }) }
    throw new Error(`Unexpected request: ${url}`)
  }

  function Probe() { return React.createElement('printing-probe', { value: usePrintingManager({ authenticated: true, isOnline: true }) }) }
  const renderer = await h.render(Probe)
  const printing = () => renderer.root.findByType('printing-probe').props.value
  await act(flushMicrotasks)

  await act(async () => { h.fireInterval(PRINT_JOB_POLL_MS); await flushMicrotasks() })
  const blockedManual = printing().printTableTab('tab-42').then(() => null, (error) => error)
  await act(flushMicrotasks)
  assert.equal(requests.filter((url) => url === '/api/table-tabs/tab-42/print-document').length, 0)
  assert.equal((await blockedManual).code, 'PRINT_BUSY')

  await act(async () => {
    pendingClaim.resolve({ ok: true, json: async () => ({ job: automaticTestJob() }) })
    await automaticWriteStarted.promise
  })
  assert.equal(activeTransports, 1)
  await assert.rejects(printing().printTableTab('tab-42'), { code: 'PRINT_BUSY' })

  await act(async () => { automaticWrite.resolve(); await flushMicrotasks() })
  for (let attempt = 0; attempt < 20 && printing().busyJobId; attempt += 1) await act(flushMicrotasks)
  assert.equal(printing().busyJobId, null)
  await act(async () => {
    assert.deepEqual(await printing().printTableTab('tab-42'), { status: 'printed', copiesPrinted: 1 })
  })

  assert.equal(writeCount, 2)
  assert.equal(maximumTransportConcurrency, 1)
  assert.equal(requests.filter((url) => url === '/api/printing/jobs/claim-next').length, 1)
  assert.equal(requests.some((url) => /\/api\/orders\/.*\/print-jobs|\/fail$|\/retry$/.test(url)), false)
})

test('a deferred manual comanda fetch blocks automatic claim until a later poll after release', async (t) => {
  const h = await workspaceHarness(t, { userAgent: 'Windows' })
  useFakeQz(t, h)
  useControlledIntervals(t, h)
  globalThis.localStorage.setItem('delivery-printer-fingerprint:test-station', JSON.stringify({ usbVendorId: 1, usbProductId: 2 }))
  const pendingDocument = deferred()
  const manualWrite = deferred()
  const manualWriteStarted = deferred()
  t.after(() => {
    pendingDocument.resolve({ ok: true, json: async () => ({ document: tableTabDocument() }) })
    manualWrite.resolve()
  })
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
    if (url === '/api/printing/stations') return { ok: true, json: async () => ({ stations: [{ id: 'test-station', platform: 'windows', isPrimary: true, autoPrintEnabled: true, defaultCopies: 2 }] }) }
    if (url.startsWith('/api/printing/jobs?')) return { ok: true, json: async () => ({ jobs: [] }) }
    if (url === '/api/printing/jobs/summary') return { ok: true, json: async () => ({ summary: { safeBacklog: 0 } }) }
    if (url === '/api/printing/stations/test-station/heartbeat') return { ok: true, json: async () => ({ station: { id: 'test-station', platform: 'windows', isPrimary: true, autoPrintEnabled: true, defaultCopies: 2 } }) }
    if (url === '/api/table-tabs/tab-42/print-document') return pendingDocument.promise
    if (url === '/api/printing/jobs/claim-next') return { ok: true, json: async () => ({ job: automaticTestJob() }) }
    if (url === '/api/printing/jobs/automatic-job/attempts') return { ok: true, json: async () => ({ attempt: { id: 'attempt-1', spoolJobName: 'GESTAO-DELIVERY:automatic-job:COPY:1:ATTEMPT:1' } }) }
    if (url === '/api/printing/attempts/attempt-1/submitting' || url === '/api/printing/attempts/attempt-1/events') return { ok: true, json: async () => ({ attempt: { id: 'attempt-1' } }) }
    if (url === '/api/printing/jobs/automatic-job/complete') return { ok: true, json: async () => ({ job: { ...automaticTestJob(), status: 'printed', copiesPrinted: 1 } }) }
    throw new Error(`Unexpected request: ${url}`)
  }

  function Probe() { return React.createElement('printing-probe', { value: usePrintingManager({ authenticated: true, isOnline: true }) }) }
  const renderer = await h.render(Probe)
  const printing = () => renderer.root.findByType('printing-probe').props.value
  await act(flushMicrotasks)

  let manualPrint
  await act(async () => { manualPrint = printing().printTableTab('tab-42'); await flushMicrotasks() })
  await act(async () => { h.fireInterval(PRINT_JOB_POLL_MS); await flushMicrotasks() })
  assert.equal(requests.filter((url) => url === '/api/printing/jobs/claim-next').length, 0)

  await act(async () => {
    pendingDocument.resolve({ ok: true, json: async () => ({ document: tableTabDocument() }) })
    await manualWriteStarted.promise
  })
  assert.equal(activeTransports, 1)
  await act(async () => { h.fireInterval(PRINT_JOB_POLL_MS); await flushMicrotasks() })
  assert.equal(requests.filter((url) => url === '/api/printing/jobs/claim-next').length, 0)

  await act(async () => { manualWrite.resolve(); await manualPrint })
  await act(async () => { h.fireInterval(PRINT_JOB_POLL_MS); await flushMicrotasks() })

  assert.equal(requests.filter((url) => url === '/api/printing/jobs/claim-next').length, 1)
  assert.equal(writeCount, 2)
  assert.equal(maximumTransportConcurrency, 1)
  assert.equal(requests.some((url) => /\/api\/orders\/.*\/print-jobs|\/fail$|\/retry$/.test(url)), false)
})
