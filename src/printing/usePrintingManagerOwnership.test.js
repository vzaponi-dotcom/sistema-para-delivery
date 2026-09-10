import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import qz from 'qz-tray'
import { workspaceHarness } from '../test-support/renderWorkspace.js'
import { deferred } from '../test-support/comandaFixtures.js'
import { PRINT_JOB_POLL_MS, usePrintingManager } from './usePrintingManager.js'

const flushMicrotasks = async () => {
  for (let index = 0; index < 8; index += 1) await Promise.resolve()
}

const runInAct = async (operation) => {
  let result
  await act(async () => { result = await operation() })
  return result
}

const station = { id: 'test-station', platform: 'other', isPrimary: true, autoPrintEnabled: true, defaultCopies: 2 }
const tableDocument = (id = 'tab-42') => ({
  type: 'table-tab', business: { name: 'Restaurante' },
  tableTab: { id, number: 42, tableName: 'Mesa 7' }, items: [],
  financial: { totalCents: 0 }, message: 'PR\u00c9-CONTA',
})
const queueJob = (id, overrides = {}) => ({
  id, document: { type: 'test', business: { name: 'Restaurante' }, test: { title: 'TESTE', message: 'OK' } },
  copiesRequested: 1, copiesPrinted: 0, ...overrides,
})
const jsonResponse = (payload) => ({ ok: true, json: async () => payload })

async function mountManager(t, { fetch, getPorts, requestPort, open, close, write, onError, userAgent = 'test', qzPrinterName } = {}) {
  const h = await workspaceHarness(t)
  globalThis.document.createElement = (tagName) => {
    if (tagName !== 'canvas') return {}
    const canvas = { width: 0, height: 0 }
    canvas.getContext = () => ({
      fillRect() {}, fillText() {},
      getImageData: () => ({ data: new Uint8ClampedArray(canvas.width * canvas.height * 4).fill(255) }),
    })
    return canvas
  }
  const originalSetInterval = globalThis.setInterval
  const originalClearInterval = globalThis.clearInterval
  globalThis.setInterval = h.window.setInterval
  globalThis.clearInterval = h.window.clearInterval
  t.after(() => {
    globalThis.setInterval = originalSetInterval
    globalThis.clearInterval = originalClearInterval
  })
  globalThis.navigator.userAgent = userAgent
  globalThis.localStorage.setItem('delivery-printer-fingerprint:test-station', JSON.stringify({ usbVendorId: 1, usbProductId: 2 }))
  if (qzPrinterName) globalThis.localStorage.setItem('delivery-qz-printer-name:test-station', qzPrinterName)
  const port = {
    getInfo: () => ({ usbVendorId: 1, usbProductId: 2 }),
    open: open || (async () => {}), close: close || (async () => {}),
    writable: { getWriter: () => ({ write: write || (async () => {}), releaseLock() {} }) },
  }
  globalThis.navigator.serial = {
    getPorts: async () => (getPorts ? getPorts(port) : [port]),
    requestPort: async () => (requestPort ? requestPort(port) : port),
  }
  globalThis.fetch = fetch
  function Probe({ authenticated = true }) {
    return React.createElement('printing-probe', { value: usePrintingManager({ authenticated, isOnline: true, onError }) })
  }
  const renderer = await h.render(Probe)
  const current = () => renderer.root.findByType('printing-probe').props.value
  await act(flushMicrotasks)
  return { h, port, renderer, Probe, current }
}

const installQzFake = (t, { find, print } = {}) => {
  const originals = {
    isActive: qz.websocket.isActive,
    connect: qz.websocket.connect,
    find: qz.printers.find,
    create: qz.configs.create,
    print: qz.print,
    setCertificatePromise: qz.security.setCertificatePromise,
    setSignatureAlgorithm: qz.security.setSignatureAlgorithm,
    setSignaturePromise: qz.security.setSignaturePromise,
  }
  qz.websocket.isActive = () => true
  qz.websocket.connect = async () => {}
  qz.printers.find = find || (async () => [])
  qz.configs.create = (printer) => ({ printer })
  qz.print = print || (async () => {})
  qz.security.setCertificatePromise = () => {}
  qz.security.setSignatureAlgorithm = () => {}
  qz.security.setSignaturePromise = () => {}
  t.after(() => {
    qz.websocket.isActive = originals.isActive
    qz.websocket.connect = originals.connect
    qz.printers.find = originals.find
    qz.configs.create = originals.create
    qz.print = originals.print
    qz.security.setCertificatePromise = originals.setCertificatePromise
    qz.security.setSignatureAlgorithm = originals.setSignatureAlgorithm
    qz.security.setSignaturePromise = originals.setSignaturePromise
  })
}

test('replacement session ignores stale Web Serial discovery and cannot probe until its physical owner releases', async (t) => {
  const discovery = deferred()
  const probe = deferred()
  t.after(() => { discovery.resolve([]); probe.resolve() })
  const reported = []
  const requests = []
  let getPortsCalls = 0
  let activeDiscovery = 0
  let maximumDiscovery = 0
  let openCalls = 0
  const manager = await mountManager(t, {
    onError: (error) => reported.push(error.message),
    getPorts: async (port) => {
      getPortsCalls += 1
      if (getPortsCalls === 1) return []
      activeDiscovery += 1
      maximumDiscovery = Math.max(maximumDiscovery, activeDiscovery)
      try {
        if (getPortsCalls === 2) { await discovery.promise; return [port] }
        return []
      } finally {
        activeDiscovery -= 1
      }
    },
    open: async () => {
      openCalls += 1
      if (openCalls === 1) await probe.promise
    },
    fetch: async (path) => {
      const url = String(path); requests.push(url)
      if (url === '/api/printing/stations') return jsonResponse({ stations: [{ ...station, isPrimary: false, autoPrintEnabled: false }] })
      if (url.startsWith('/api/printing/jobs?')) return jsonResponse({ jobs: [] })
      if (url === '/api/table-tabs/old/print-document') return jsonResponse({ document: tableDocument('old') })
      if (url === '/api/table-tabs/new/print-document') return jsonResponse({ document: tableDocument('new') })
      throw new Error(`Unexpected request: ${url}`)
    },
  })

  let oldPrint
  await act(async () => { oldPrint = manager.current().printTableTab('old'); await flushMicrotasks() })
  await act(async () => manager.renderer.update(React.createElement(manager.Probe, { authenticated: false })))
  await act(async () => manager.renderer.update(React.createElement(manager.Probe, { authenticated: true })))
  await act(flushMicrotasks)
  await assert.rejects(manager.current().printTableTab('new'), { code: 'PRINT_BUSY' })
  assert.equal(requests.some((url) => url.includes('/table-tabs/new/')), false)

  await act(async () => { discovery.resolve(); await flushMicrotasks() })
  assert.equal(openCalls, 1)
  assert.equal(maximumDiscovery, 1)
  await act(async () => { probe.resolve(); await oldPrint })
  assert.equal(manager.current().transportReady, false)
  assert.equal(manager.current().printerState, 'unconfigured')
  assert.equal(manager.current().lastError, null)
  assert.deepEqual(reported, [])

  assert.deepEqual(await runInAct(() => manager.current().printTableTab('new')), { status: 'printed', copiesPrinted: 1 })
  assert.equal(requests.some((url) => url.includes('/table-tabs/new/')), true)
})

test('replacement session ignores stale QZ discovery and waits for its discovery owner before retrying', async (t) => {
  const oldDiscovery = deferred()
  t.after(() => oldDiscovery.resolve(['Old Printer', 'New Printer']))
  let findCalls = 0
  let activeDiscovery = 0
  let maximumDiscovery = 0
  const printedTo = []
  installQzFake(t, {
    find: async () => {
      findCalls += 1
      if (findCalls === 1) return ['Old Printer', 'New Printer']
      activeDiscovery += 1
      maximumDiscovery = Math.max(maximumDiscovery, activeDiscovery)
      try {
        if (findCalls === 2) return await oldDiscovery.promise
        return ['Old Printer', 'New Printer']
      } finally {
        activeDiscovery -= 1
      }
    },
    print: async (config) => { printedTo.push(config.printer) },
  })
  const reported = []
  const requests = []
  const manager = await mountManager(t, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    qzPrinterName: 'Old Printer',
    onError: (error) => reported.push(error.message),
    fetch: async (path) => {
      const url = String(path); requests.push(url)
      if (url === '/api/printing/stations') return jsonResponse({ stations: [{ ...station, platform: 'windows', isPrimary: false, autoPrintEnabled: false }] })
      if (url.startsWith('/api/printing/jobs?')) return jsonResponse({ jobs: [] })
      if (url === '/api/table-tabs/new/print-document') return jsonResponse({ document: tableDocument('new') })
      throw new Error(`Unexpected request: ${url}`)
    },
  })

  let oldConnect
  await act(async () => { oldConnect = manager.current().connectPrinter(); await flushMicrotasks() })
  globalThis.localStorage.setItem('delivery-qz-printer-name:test-station', 'New Printer')
  await act(async () => manager.renderer.update(React.createElement(manager.Probe, { authenticated: false })))
  await act(async () => manager.renderer.update(React.createElement(manager.Probe, { authenticated: true })))
  await act(flushMicrotasks)
  await assert.rejects(manager.current().printTableTab('new'), { code: 'PRINT_BUSY' })
  assert.equal(maximumDiscovery, 1)

  await act(async () => { oldDiscovery.resolve(['Old Printer', 'New Printer']); await oldConnect })
  assert.equal(manager.current().configuredPrinterName, null)
  assert.equal(manager.current().transportReady, false)
  assert.equal(manager.current().lastError, null)
  assert.deepEqual(reported, [])

  assert.deepEqual(await runInAct(() => manager.current().printTableTab('new')), { status: 'printed', copiesPrinted: 1 })
  assert.deepEqual(printedTo, ['New Printer'])
  assert.equal(requests.some((url) => url === '/api/printing/test-jobs' || /\/api\/printing\/jobs\/(?:claim-next|[^/?]+\/(?:claim|complete|fail|retry))$/.test(url)), false)
})

test('QZ operation keeps its resolved printer immutable across authentication and station replacement', async (t) => {
  const oldDocument = deferred()
  const oldWrite = deferred()
  const oldWriteStarted = deferred()
  t.after(() => { oldDocument.resolve(jsonResponse({ document: tableDocument('old') })); oldWrite.resolve() })
  const printedTo = []
  let activeWrites = 0
  let maximumWrites = 0
  installQzFake(t, {
    find: async () => ['Old Printer', 'New Printer'],
    print: async (config) => {
      printedTo.push(config.printer)
      activeWrites += 1
      maximumWrites = Math.max(maximumWrites, activeWrites)
      try {
        if (printedTo.length === 1) { oldWriteStarted.resolve(); await oldWrite.promise }
      } finally {
        activeWrites -= 1
      }
    },
  })
  const requests = []
  const manager = await mountManager(t, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    qzPrinterName: 'Old Printer',
    fetch: async (path) => {
      const url = String(path); requests.push(url)
      if (url === '/api/printing/stations') return jsonResponse({ stations: [{ ...station, platform: 'windows', isPrimary: false, autoPrintEnabled: false }] })
      if (url.startsWith('/api/printing/jobs?')) return jsonResponse({ jobs: [] })
      if (url === '/api/table-tabs/old/print-document') return oldDocument.promise
      if (url === '/api/table-tabs/new/print-document') return jsonResponse({ document: tableDocument('new') })
      throw new Error(`Unexpected request: ${url}`)
    },
  })

  let oldPrint
  await act(async () => { oldPrint = manager.current().printTableTab('old'); await flushMicrotasks() })
  globalThis.localStorage.setItem('delivery-qz-printer-name:test-station', 'New Printer')
  await act(async () => manager.renderer.update(React.createElement(manager.Probe, { authenticated: false })))
  await act(async () => manager.renderer.update(React.createElement(manager.Probe, { authenticated: true })))
  await act(flushMicrotasks)
  await assert.rejects(manager.current().printTableTab('new'), { code: 'PRINT_BUSY' })

  await act(async () => { oldDocument.resolve(jsonResponse({ document: tableDocument('old') })); await oldWriteStarted.promise })
  assert.deepEqual(printedTo, ['Old Printer'])
  await assert.rejects(manager.current().printTableTab('new'), { code: 'PRINT_BUSY' })
  await act(async () => { oldWrite.resolve(); await oldPrint })

  assert.deepEqual(await runInAct(() => manager.current().printTableTab('new')), { status: 'printed', copiesPrinted: 1 })
  assert.deepEqual(printedTo, ['Old Printer', 'New Printer'])
  assert.equal(maximumWrites, 1)
  assert.equal(requests.some((url) => url === '/api/printing/test-jobs' || /\/api\/printing\/jobs\/(?:claim-next|[^/?]+\/(?:claim|complete|fail|retry))$/.test(url)), false)
})

test('queued QZ operation also keeps its resolved printer immutable across authentication replacement', async (t) => {
  const createJob = deferred()
  t.after(() => createJob.resolve(jsonResponse({ job: queueJob('queued-old') })))
  const printedTo = []
  installQzFake(t, {
    find: async () => ['Old Printer', 'New Printer'],
    print: async (config) => { printedTo.push(config.printer) },
  })
  const manager = await mountManager(t, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    qzPrinterName: 'Old Printer',
    fetch: async (path) => {
      const url = String(path)
      if (url === '/api/printing/stations') return jsonResponse({ stations: [{ ...station, platform: 'windows', isPrimary: false, autoPrintEnabled: false }] })
      if (url.startsWith('/api/printing/jobs?')) return jsonResponse({ jobs: [] })
      if (url === '/api/orders/order-1/print-jobs') return createJob.promise
      if (url === '/api/printing/jobs/queued-old/claim') return jsonResponse({ job: queueJob('queued-old') })
      if (url === '/api/printing/jobs/queued-old/complete') return jsonResponse({ job: queueJob('queued-old', { status: 'printed', copiesPrinted: 1 }) })
      if (url === '/api/table-tabs/new/print-document') return jsonResponse({ document: tableDocument('new') })
      throw new Error(`Unexpected request: ${url}`)
    },
  })

  let oldPrint
  await act(async () => { oldPrint = manager.current().printOrder('order-1', 1); await flushMicrotasks() })
  globalThis.localStorage.setItem('delivery-qz-printer-name:test-station', 'New Printer')
  await act(async () => manager.renderer.update(React.createElement(manager.Probe, { authenticated: false })))
  await act(async () => manager.renderer.update(React.createElement(manager.Probe, { authenticated: true })))
  await act(flushMicrotasks)
  await assert.rejects(manager.current().printTableTab('new'), { code: 'PRINT_BUSY' })

  let oldResult
  await act(async () => {
    createJob.resolve(jsonResponse({ job: queueJob('queued-old') }))
    oldResult = await oldPrint
  })
  assert.deepEqual(oldResult, { status: 'printed' })
  assert.deepEqual(printedTo, ['Old Printer'])

  assert.deepEqual(await runInAct(() => manager.current().printTableTab('new')), { status: 'printed', copiesPrinted: 1 })
  assert.deepEqual(printedTo, ['Old Printer', 'New Printer'])
})

test('Web Serial automatic discovery owns physical printing before deferred getPorts', async (t) => {
  const discovery = deferred()
  const automaticWrite = deferred()
  const automaticWriteStarted = deferred()
  t.after(() => { discovery.resolve([]); automaticWrite.resolve() })
  let getPortsCount = 0
  let writes = 0
  const requests = []
  const manager = await mountManager(t, {
    getPorts: async (port) => (++getPortsCount === 1 ? [port] : discovery.promise),
    write: async () => {
      writes += 1
      if (writes === 1) { automaticWriteStarted.resolve(); await automaticWrite.promise }
    },
    fetch: async (path) => {
      const url = String(path); requests.push(url)
      if (url === '/api/printing/stations') return jsonResponse({ stations: [station] })
      if (url.startsWith('/api/printing/jobs?')) return jsonResponse({ jobs: [] })
      if (url === '/api/printing/jobs/claim-next') return jsonResponse({ job: queueJob('auto-discovery') })
      if (url === '/api/printing/jobs/auto-discovery/complete') return jsonResponse({ job: queueJob('auto-discovery', { status: 'printed', copiesPrinted: 1 }) })
      if (url === '/api/table-tabs/tab-42/print-document') return jsonResponse({ document: tableDocument() })
      throw new Error(`Unexpected request: ${url}`)
    },
  })
  await act(async () => { manager.h.fireInterval(PRINT_JOB_POLL_MS); await flushMicrotasks() })
  assert.ok(manager.current().busyJobId)
  await assert.rejects(manager.current().printTableTab('tab-42'), { code: 'PRINT_BUSY' })
  assert.equal(requests.filter((url) => url.includes('/table-tabs/')).length, 0)
  assert.equal(requests.filter((url) => url.endsWith('/claim-next')).length, 0)

  await act(async () => { discovery.resolve([manager.port]); await automaticWriteStarted.promise })
  assert.equal(manager.current().busyJobId, 'auto-discovery')
  await act(async () => { automaticWrite.resolve(); await flushMicrotasks() })
  assert.equal(manager.current().busyJobId, null)
  assert.deepEqual(await runInAct(() => manager.current().printTableTab('tab-42')), { status: 'printed', copiesPrinted: 1 })
  assert.equal(writes, 2)
})

test('authentication replacement invalidates stale UI but retains physical ownership until the old write ends', async (t) => {
  const writes = [deferred(), deferred()]
  t.after(() => { for (const pending of writes) pending.resolve() })
  let writeIndex = 0
  let active = 0
  let maximumActive = 0
  const reported = []
  const manager = await mountManager(t, {
    onError: (error) => reported.push(error.message),
    write: async () => {
      const pending = writes[writeIndex++]
      active += 1
      maximumActive = Math.max(maximumActive, active)
      try { await pending.promise } finally { active -= 1 }
    },
    fetch: async (path) => {
      const url = String(path)
      if (url === '/api/printing/stations') return jsonResponse({ stations: [{ ...station, isPrimary: false, autoPrintEnabled: false }] })
      if (url.startsWith('/api/printing/jobs?')) return jsonResponse({ jobs: [] })
      if (url.includes('/print-document')) return jsonResponse({ document: tableDocument(decodeURIComponent(url.split('/').at(-2))) })
      throw new Error(`Unexpected request: ${url}`)
    },
  })

  let oldPrint
  await act(async () => { oldPrint = manager.current().printTableTab('old'); await flushMicrotasks() })
  const oldOutcome = oldPrint.then(() => null, (error) => error)
  assert.equal(active, 1)
  await act(async () => manager.renderer.update(React.createElement(manager.Probe, { authenticated: false })))
  await act(async () => manager.renderer.update(React.createElement(manager.Probe, { authenticated: true })))
  await act(flushMicrotasks)

  const blockedOutcome = manager.current().printTableTab('new').then(() => null, (error) => error)
  await act(flushMicrotasks)
  assert.equal(active, 1)
  assert.equal((await blockedOutcome)?.code, 'PRINT_BUSY')

  const staleFailure = Object.assign(new Error('old write failed'), { code: 'SERIAL_WRITE_UNCERTAIN' })
  await act(async () => writes[0].reject(staleFailure))
  assert.equal((await oldOutcome)?.code, 'SERIAL_WRITE_UNCERTAIN')
  assert.deepEqual(reported, [])
  assert.equal(manager.current().lastError, null)

  let newPrint
  await act(async () => { newPrint = manager.current().printTableTab('new'); await flushMicrotasks() })
  assert.equal(active, 1)
  await act(async () => writes[1].resolve())
  assert.deepEqual(await newPrint, { status: 'printed', copiesPrinted: 1 })
  assert.equal(maximumActive, 1)
})

test('explicit queue actions make no mutation while another physical operation owns the manager and retry after release', async (t) => {
  const manualDocument = deferred()
  t.after(() => manualDocument.resolve(jsonResponse({ document: tableDocument() })))
  const requests = []
  let writes = 0
  const manager = await mountManager(t, {
    write: async () => {
      writes += 1
      if (writes === 5) throw new Error('retry transport failed')
    },
    fetch: async (path) => {
      const url = String(path); requests.push(url)
      if (url === '/api/printing/stations') return jsonResponse({ stations: [{ ...station, isPrimary: false, autoPrintEnabled: false }] })
      if (url.startsWith('/api/printing/jobs?')) return jsonResponse({ jobs: [] })
      if (url === '/api/table-tabs/tab-42/print-document') return manualDocument.promise
      if (url === '/api/printing/test-jobs') return jsonResponse({ job: queueJob('test-job') })
      if (url === '/api/orders/order-1/print-jobs') return jsonResponse({ job: queueJob('order-job') })
      if (url.endsWith('/retry')) return jsonResponse({ job: queueJob('retry-job') })
      if (url.endsWith('/claim')) {
        const id = decodeURIComponent(url.split('/').at(-2))
        return jsonResponse({ job: id === 'second-job' ? queueJob(id, { copiesRequested: 2, copiesPrinted: 1 }) : queueJob(id) })
      }
      if (url.endsWith('/complete')) return jsonResponse({ job: {} })
      if (url.endsWith('/fail')) return jsonResponse({ job: {} })
      throw new Error(`Unexpected request: ${url}`)
    },
  })

  let manualPrint
  await act(async () => { manualPrint = manager.current().printTableTab('tab-42'); await flushMicrotasks() })
  const attempts = [
    manager.current().testPrint(),
    manager.current().printOrder('order-1', 1),
    manager.current().printSecondCopy({ id: 'second-job', status: 'printed', copiesRequested: 2, copiesPrinted: 1 }),
    manager.current().retryJob('retry-job'),
  ].map((promise) => promise.then(() => null, (error) => error))
  await act(flushMicrotasks)
  assert.deepEqual((await Promise.all(attempts)).map((error) => error?.code), ['PRINT_BUSY', 'PRINT_BUSY', 'PRINT_BUSY', 'PRINT_BUSY'])
  assert.equal(requests.some((url) => /test-jobs|print-jobs$|\/retry$|\/claim$/.test(url)), false)

  await act(async () => { manualDocument.resolve(jsonResponse({ document: tableDocument() })); await manualPrint })
  assert.deepEqual(await runInAct(() => manager.current().testPrint()), { status: 'printed' })
  assert.deepEqual(await runInAct(() => manager.current().printOrder('order-1', 1)), { status: 'printed' })
  assert.deepEqual(await runInAct(() => manager.current().printSecondCopy({ id: 'second-job', status: 'printed', copiesRequested: 2, copiesPrinted: 1 })), { status: 'printed' })
  const retryResult = await runInAct(() => manager.current().retryJob('retry-job'))
  assert.equal(retryResult.status, 'requires_attention')
  assert.equal(requests.filter((url) => url.endsWith('/complete')).length, 3)
  assert.equal(requests.filter((url) => url.endsWith('/fail')).length, 1)
})

test('claimed execution retains ownership through a rejected refresh before allowing manual retry', async (t) => {
  const refreshStarted = deferred()
  const refreshResponse = deferred()
  t.after(() => refreshResponse.resolve(jsonResponse({ stations: [] })))
  const refreshFailure = new Error('refresh failed')
  let deferRefresh = false
  let refreshRequests = 0
  let canonicalRequests = 0
  const reported = []
  const manager = await mountManager(t, {
    onError: (error) => reported.push(error.message),
    fetch: async (path) => {
      const url = String(path)
      if (url === '/api/printing/stations') {
        if (deferRefresh) { refreshRequests += 1; refreshStarted.resolve(); return refreshResponse.promise }
        return jsonResponse({ stations: [{ ...station, isPrimary: false, autoPrintEnabled: false }] })
      }
      if (url.startsWith('/api/printing/jobs?')) { if (deferRefresh) refreshRequests += 1; return jsonResponse({ jobs: [] }) }
      if (url === '/api/printing/test-jobs') return jsonResponse({ job: queueJob('refresh-job') })
      if (url === '/api/printing/jobs/refresh-job/claim') return jsonResponse({ job: queueJob('refresh-job') })
      if (url === '/api/printing/jobs/refresh-job/complete') { deferRefresh = true; return jsonResponse({ job: {} }) }
      if (url === '/api/table-tabs/tab-42/print-document') { canonicalRequests += 1; return jsonResponse({ document: tableDocument() }) }
      throw new Error(`Unexpected request: ${url}`)
    },
  })

  let print
  await act(async () => { print = manager.current().testPrint(); await refreshStarted.promise })
  assert.equal(manager.current().busyJobId, 'refresh-job')
  await assert.rejects(manager.current().printTableTab('tab-42'), { code: 'PRINT_BUSY' })
  assert.equal(canonicalRequests, 0)
  let printResult
  await act(async () => { refreshResponse.reject(refreshFailure); printResult = await print })
  assert.deepEqual(printResult, { status: 'printed' })
  assert.ok(refreshRequests >= 1)
  assert.deepEqual(reported, ['refresh failed'])
  assert.deepEqual(await runInAct(() => manager.current().printTableTab('tab-42')), { status: 'printed', copiesPrinted: 1 })
})

test('rejected fail reporting releases physically but cannot report into a replacement generation', async (t) => {
  const failStarted = deferred()
  const failResponse = deferred()
  t.after(() => failResponse.resolve(jsonResponse({ job: {} })))
  const reported = []
  let writes = 0
  const manager = await mountManager(t, {
    onError: (error) => reported.push(error.message),
    write: async () => {
      writes += 1
      if (writes === 1) throw Object.assign(new Error('transport failed'), { code: 'SERIAL_WRITE_UNCERTAIN' })
    },
    fetch: async (path) => {
      const url = String(path)
      if (url === '/api/printing/stations') return jsonResponse({ stations: [{ ...station, isPrimary: false, autoPrintEnabled: false }] })
      if (url.startsWith('/api/printing/jobs?')) return jsonResponse({ jobs: [] })
      if (url === '/api/printing/test-jobs') return jsonResponse({ job: queueJob('failed-job') })
      if (url === '/api/printing/jobs/failed-job/claim') return jsonResponse({ job: queueJob('failed-job') })
      if (url === '/api/printing/jobs/failed-job/fail') { failStarted.resolve(); return failResponse.promise }
      if (url === '/api/table-tabs/new/print-document') return jsonResponse({ document: tableDocument('new') })
      throw new Error(`Unexpected request: ${url}`)
    },
  })

  let oldPrint
  await act(async () => { oldPrint = manager.current().testPrint(); await failStarted.promise })
  const oldOutcome = oldPrint.then(() => null, (error) => error)
  await act(async () => manager.renderer.update(React.createElement(manager.Probe, { authenticated: false })))
  await act(async () => manager.renderer.update(React.createElement(manager.Probe, { authenticated: true })))
  await act(flushMicrotasks)
  await assert.rejects(manager.current().printTableTab('new'), { code: 'PRINT_BUSY' })

  const failError = new Error('fail reporting rejected')
  let oldError
  await act(async () => { failResponse.reject(failError); oldError = await oldOutcome })
  assert.equal(oldError.code, 'SERIAL_WRITE_UNCERTAIN')
  assert.equal(oldError.message, 'A conexão caiu durante a impressão. O resultado físico é incerto.')
  assert.equal(oldError.cause, oldError.operationalError)
  assert.equal(oldError.operationalError.code, 'SERIAL_WRITE_UNCERTAIN')
  assert.equal(oldError.reportingError, failError)
  assert.deepEqual(reported, [])
  assert.equal(manager.current().lastError, null)
  assert.deepEqual(await runInAct(() => manager.current().printTableTab('new')), { status: 'printed', copiesPrinted: 1 })
})

test('rejected fail reporting updates the current UI while its physical owner is still held', async (t) => {
  const failError = new Error('current fail reporting rejected')
  const failStarted = deferred()
  const failResponse = deferred()
  t.after(() => failResponse.resolve(jsonResponse({ job: {} })))
  const observations = []
  let manager
  let writes = 0
  manager = await mountManager(t, {
    onError: (error) => observations.push({
      message: error.message,
      code: error.code,
      reportingError: error.reportingError,
      busyJobId: manager.current().busyJobId,
    }),
    write: async () => {
      writes += 1
      if (writes === 1) throw Object.assign(new Error('transport failed'), { code: 'SERIAL_WRITE_UNCERTAIN' })
    },
    fetch: async (path) => {
      const url = String(path)
      if (url === '/api/printing/stations') return jsonResponse({ stations: [{ ...station, isPrimary: false, autoPrintEnabled: false }] })
      if (url.startsWith('/api/printing/jobs?')) return jsonResponse({ jobs: [] })
      if (url === '/api/printing/test-jobs') return jsonResponse({ job: queueJob('current-failed-job') })
      if (url === '/api/printing/jobs/current-failed-job/claim') return jsonResponse({ job: queueJob('current-failed-job') })
      if (url === '/api/printing/jobs/current-failed-job/fail') { failStarted.resolve(); return failResponse.promise }
      if (url === '/api/table-tabs/tab-42/print-document') return jsonResponse({ document: tableDocument() })
      throw new Error(`Unexpected request: ${url}`)
    },
  })

  let print
  await act(async () => { print = manager.current().testPrint(); await failStarted.promise })
  assert.equal(manager.current().busyJobId, 'current-failed-job')
  let outcome
  await act(async () => { failResponse.reject(failError); outcome = await print.then(() => null, (error) => error) })
  assert.equal(outcome.code, 'SERIAL_WRITE_UNCERTAIN')
  assert.equal(outcome.message, 'A conexão caiu durante a impressão. O resultado físico é incerto.')
  assert.equal(outcome.cause, outcome.operationalError)
  assert.equal(outcome.operationalError.code, 'SERIAL_WRITE_UNCERTAIN')
  assert.equal(outcome.reportingError, failError)
  assert.deepEqual(observations, [{
    message: 'A conexão caiu durante a impressão. O resultado físico é incerto.',
    code: 'SERIAL_WRITE_UNCERTAIN',
    reportingError: failError,
    busyJobId: 'current-failed-job',
  }])
  assert.equal(manager.current().busyJobId, null)
  assert.deepEqual(await runInAct(() => manager.current().printTableTab('tab-42')), { status: 'printed', copiesPrinted: 1 })
})
