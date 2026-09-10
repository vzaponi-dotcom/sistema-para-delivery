import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
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

async function mountManager(t, { fetch, getPorts, write, onError } = {}) {
  const h = await workspaceHarness(t)
  const originalSetInterval = globalThis.setInterval
  const originalClearInterval = globalThis.clearInterval
  globalThis.setInterval = h.window.setInterval
  globalThis.clearInterval = h.window.clearInterval
  t.after(() => {
    globalThis.setInterval = originalSetInterval
    globalThis.clearInterval = originalClearInterval
  })
  globalThis.localStorage.setItem('delivery-printer-fingerprint:test-station', JSON.stringify({ usbVendorId: 1, usbProductId: 2 }))
  const port = {
    getInfo: () => ({ usbVendorId: 1, usbProductId: 2 }),
    open: async () => {}, close: async () => {},
    writable: { getWriter: () => ({ write: write || (async () => {}), releaseLock() {} }) },
  }
  globalThis.navigator.serial = { getPorts: async () => (getPorts ? getPorts(port) : [port]), requestPort: async () => port }
  globalThis.fetch = fetch
  function Probe({ authenticated = true }) {
    return React.createElement('printing-probe', { value: usePrintingManager({ authenticated, isOnline: true, onError }) })
  }
  const renderer = await h.render(Probe)
  const current = () => renderer.root.findByType('printing-probe').props.value
  await act(flushMicrotasks)
  return { h, port, renderer, Probe, current }
}

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
  assert.equal(oldError, failError)
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
    onError: (error) => observations.push({ message: error.message, busyJobId: manager.current().busyJobId }),
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
  assert.equal(outcome, failError)
  assert.deepEqual(observations, [{ message: 'current fail reporting rejected', busyJobId: 'current-failed-job' }])
  assert.equal(manager.current().busyJobId, null)
  assert.deepEqual(await runInAct(() => manager.current().printTableTab('tab-42')), { status: 'printed', copiesPrinted: 1 })
})
