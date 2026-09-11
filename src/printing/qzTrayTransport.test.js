import test from 'node:test'
import assert from 'node:assert/strict'
import * as qzTransport from './qzTrayTransport.js'
import {
  configureQzSecurity,
  deriveQzOperationalState,
  ensureQzConnected,
  listQzPrinters,
  resolveQzPrinter,
  printQzRawBytes,
} from './qzTrayTransport.js'

test('QZ operational state separates connection, configured queue, queue discovery and readiness', () => {
  assert.deepEqual(deriveQzOperationalState({
    qzConnected: true,
    printerQueueConfigured: true,
    printerQueueFound: true,
    physicalState: 'ready',
  }), {
    qzConnected: true,
    printerQueueConfigured: true,
    printerQueueFound: true,
    operationalReady: true,
  })
  assert.equal(deriveQzOperationalState({
    qzConnected: true,
    printerQueueConfigured: true,
    printerQueueFound: false,
  }).operationalReady, false)
  assert.equal(deriveQzOperationalState({
    qzConnected: true,
    printerQueueConfigured: true,
    printerQueueFound: true,
    physicalState: 'printer_offline',
  }).operationalReady, false)
  assert.equal(deriveQzOperationalState({
    qzConnected: false,
    printerQueueConfigured: true,
    printerQueueFound: true,
  }).operationalReady, false)
})

test('QZ readiness probes are single-flight and keep the last valid state while rechecking', async () => {
  assert.equal(typeof qzTransport.createQzReadinessController, 'function')

  let resolveProbe
  let calls = 0
  const controller = qzTransport.createQzReadinessController()
  const probe = async () => {
    calls += 1
    return new Promise((resolve) => { resolveProbe = resolve })
  }

  const initialProbe = controller.probe(probe)
  await Promise.resolve()
  resolveProbe('MPT-II')
  assert.equal(await initialProbe, 'MPT-II')
  assert.equal(controller.isReady(), true)

  const recheck = controller.probe(probe)
  const duplicateRecheck = controller.probe(probe)
  assert.equal(controller.isReady(), true)
  assert.equal(calls, 1)
  await Promise.resolve()
  resolveProbe('MPT-II')
  assert.equal(await recheck, 'MPT-II')
  assert.equal(await duplicateRecheck, 'MPT-II')
  assert.equal(controller.isReady(), true)
})

test('QZ readiness becomes unavailable only after a failed probe and recovers on reconnection', async () => {
  const outcomes = [
    Promise.resolve('MPT-II'),
    Promise.reject(Object.assign(new Error('missing'), { code: 'QZ_PRINTER_NOT_FOUND' })),
    Promise.resolve('MPT-II'),
  ]
  const controller = qzTransport.createQzReadinessController()

  assert.equal(await controller.probe(() => outcomes.shift()), 'MPT-II')
  assert.equal(controller.isReady(), true)
  await assert.rejects(() => controller.probe(() => outcomes.shift()), /missing/)
  assert.equal(controller.isReady(), false)
  assert.equal(await controller.probe(() => outcomes.shift()), 'MPT-II')
  assert.equal(controller.isReady(), true)
})

test('an invalidated QZ probe cannot restore readiness after close or reconnect', async () => {
  let resolveProbe
  const controller = qzTransport.createQzReadinessController()
  const staleProbe = controller.probe(() => new Promise((resolve) => { resolveProbe = resolve }))

  await Promise.resolve()
  controller.invalidate()
  const freshProbe = controller.probe(async () => 'MPT-II')
  assert.equal(await freshProbe, 'MPT-II')
  resolveProbe('MPT-II')
  await assert.rejects(staleProbe, (error) => error.code === 'QZ_STALE_PROBE')
  assert.equal(controller.isReady(), true)
})

const makeSecurityFake = () => {
  const calls = {}
  return {
    calls,
    api: {
      security: {
        setCertificatePromise: (factory) => { calls.certificateFactory = factory },
        setSignatureAlgorithm: (algorithm) => { calls.signatureAlgorithm = algorithm },
        setSignaturePromise: (factory) => { calls.signatureFactory = factory },
      },
    },
  }
}

test('configures QZ certificate and SHA512 signature callbacks', async () => {
  const { api, calls } = makeSecurityFake()
  configureQzSecurity({
    qzApi: api,
    getCertificate: async () => 'CERTIFICATE',
    signPayload: async (value) => `signed:${value}`,
  })

  assert.equal(calls.signatureAlgorithm, 'SHA512')

  const certificate = await new Promise((resolve, reject) => calls.certificateFactory(resolve, reject))
  assert.equal(certificate, 'CERTIFICATE')

  const signature = await new Promise((resolve, reject) => calls.signatureFactory('payload')(resolve, reject))
  assert.equal(signature, 'signed:payload')
})

test('connects to QZ only when websocket is inactive', async () => {
  let active = false
  let connections = 0
  const qzApi = {
    websocket: {
      isActive: () => active,
      connect: async () => { connections += 1; active = true },
    },
  }

  await ensureQzConnected(qzApi)
  await ensureQzConnected(qzApi)

  assert.equal(connections, 1)
})

test('normalizes printer discovery results', async () => {
  const qzApi = {
    websocket: { isActive: () => true },
    printers: { find: async () => ['MPT-II', 'Microsoft Print to PDF'] },
  }

  assert.deepEqual(await listQzPrinters(qzApi), ['MPT-II', 'Microsoft Print to PDF'])
})

test('QZ printer resolution returns the configured queue', async () => {
  const qzApi = {
    websocket: { isActive: () => true },
    printers: { find: async () => ['MPT-II', 'Microsoft Print to PDF'] },
  }

  assert.equal(await resolveQzPrinter(qzApi, 'MPT-II'), 'MPT-II')
})

test('QZ printer resolution rejects a missing saved queue', async () => {
  const qzApi = {
    websocket: { isActive: () => true },
    printers: { find: async () => ['Microsoft Print to PDF'] },
  }

  await assert.rejects(
    () => resolveQzPrinter(qzApi, 'MPT-II'),
    (error) => error.code === 'QZ_PRINTER_NOT_FOUND',
  )
})

test('QZ RAW transport preserves Uint8Array bytes as base64 without mutating payload', async () => {
  let captured
  const qzApi = {
    websocket: { isActive: () => true },
    printers: { find: async () => ['MPT-II'] },
    configs: { create: (printer, options) => ({ printer, ...options }) },
    print: async (config, data) => { captured = { config, data } },
  }
  const bytes = Uint8Array.from([0x1b, 0x40, 0x00, 0xff, 0x0a])
  const original = Uint8Array.from(bytes)

  await printQzRawBytes(qzApi, 'MPT-II', bytes, { jobName: 'GESTAO-DELIVERY:job-1:COPY:1:ATTEMPT:1' })

  assert.deepEqual(bytes, original)
  assert.deepEqual(captured.config, { printer: 'MPT-II', jobName: 'GESTAO-DELIVERY:job-1:COPY:1:ATTEMPT:1' })
  assert.deepEqual(captured.data, [{
    type: 'raw',
    format: 'command',
    flavor: 'base64',
    data: Buffer.from(bytes).toString('base64'),
  }])
})

test('QZ websocket connection failures are normalized', async () => {
  const qzApi = {
    websocket: {
      isActive: () => false,
      connect: async () => { throw new Error('connection refused') },
    },
  }

  await assert.rejects(
    () => ensureQzConnected(qzApi),
    (error) => error.code === 'QZ_UNAVAILABLE',
  )
})

test('QZ print rejection becomes QZ_PRINT_FAILED after one spool attempt', async () => {
  let printCalls = 0
  const qzApi = {
    websocket: { isActive: () => true },
    printers: { find: async () => ['MPT-II'] },
    configs: { create: (printer) => ({ printer }) },
    print: async () => { printCalls += 1; throw new Error('spool failed') },
  }

  await assert.rejects(
    () => printQzRawBytes(qzApi, 'MPT-II', Uint8Array.from([0x1b, 0x40])),
    (error) => error.code === 'QZ_PRINT_FAILED',
  )
  assert.equal(printCalls, 1)
})
