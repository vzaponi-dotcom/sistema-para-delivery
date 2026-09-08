import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { canConsumeAutomaticPrintJob } from './usePrintingManager.js'
import { runClaimedPrintJob } from './printJobRunner.js'

const manager = await readFile(new URL('./usePrintingManager.js', import.meta.url), 'utf8')

const readyConsumer = (overrides = {}) => ({
  authenticated: true,
  isOnline: true,
  supported: true,
  visible: true,
  browserOnline: true,
  busyJobId: null,
  printerBlocked: false,
  transportReady: true,
  isQz: true,
  station: { isPrimary: true, autoPrintEnabled: true, platform: 'windows' },
  ...overrides,
})

test('only the primary QZ station may consume automatic jobs locally', () => {
  assert.equal(canConsumeAutomaticPrintJob(readyConsumer()), true)
  assert.equal(canConsumeAutomaticPrintJob(readyConsumer({ isQz: false })), false)
})

test('manual print request only enqueues and never opens or executes local transport', () => {
  const start = manager.indexOf('const printOrder = useCallback')
  assert.notEqual(start, -1)
  const end = manager.indexOf('const printSecondCopy = useCallback', start)
  assert.notEqual(end, -1)
  const block = manager.slice(start, end)

  assert.match(block, /createManualPrintJob\(orderId, copies\)/)
  assert.doesNotMatch(block, /getExplicitPort\(/)
  assert.doesNotMatch(block, /claimPrintJob\(/)
  assert.doesNotMatch(block, /executeClaimedJob\(/)
})

test('waiting_second_copy is a successful physical pass and does not mark the QZ transport disconnected', () => {
  const start = manager.indexOf('const executeClaimedJob = useCallback')
  assert.notEqual(start, -1)
  const end = manager.indexOf('const saveStationSettings = useCallback', start)
  assert.notEqual(end, -1)
  const block = manager.slice(start, end)

  assert.match(block, /\['printed', 'waiting_second_copy'\]\.includes\(result\.status\)/)
})

test('explicit second-copy execution only accepts the dedicated waiting state', () => {
  const start = manager.indexOf('const printSecondCopy = useCallback')
  assert.notEqual(start, -1)
  const end = manager.indexOf('const retryJob = useCallback', start)
  assert.notEqual(end, -1)
  const block = manager.slice(start, end)

  assert.match(block, /job\.status !== 'waiting_second_copy'/)
})

test('QZ transport failure is surfaced as requires_attention to the caller', async () => {
  const error = Object.assign(new Error('QZ recusou o envio.'), { code: 'QZ_PRINT_FAILED' })
  let failPayload = null
  const result = await runClaimedPrintJob({
    job: {
      id: 'job-qz-failure',
      document: { version: 1, type: 'order' },
      copiesRequested: 1,
      copiesPrinted: 0,
    },
    stationId: 'kitchen-qz',
    port: null,
    completeJob: async () => assert.fail('failed QZ transport must not complete the job'),
    failJob: async (_jobId, _stationId, payload) => { failPayload = payload },
    renderer: () => new Uint8Array([1]),
    transport: async () => { throw error },
  })

  assert.equal(result.status, 'requires_attention')
  assert.equal(result.error, error)
  assert.deepEqual(failPayload, {
    code: 'QZ_PRINT_FAILED',
    message: 'QZ recusou o envio.',
    uncertain: false,
  })
})
