import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
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
} from './usePrintingManager.js'
import { runClaimedPrintJob } from './printJobRunner.js'

const managerSource = await readFile(new URL('./usePrintingManager.js', import.meta.url), 'utf8')

const awaitingSecondCopyJob = {
  status: 'awaiting_second_copy',
  copiesRequested: 2,
  copiesPrinted: 1,
}

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
