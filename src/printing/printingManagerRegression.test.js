import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  canConsumeAutomaticPrintJob,
  getPrintingTransportKind,
  isPrintingTransportSupported,
} from './usePrintingManager.js'

const manager = await readFile(new URL('./usePrintingManager.js', import.meta.url), 'utf8')
const app = await readFile(new URL('../App.jsx', import.meta.url), 'utf8')

test('printing manager is driven by official job APIs and never by new-order detection', () => {
  for (const apiName of [
    'getPrintStations',
    'upsertPrintStation',
    'makePrimaryPrintStation',
    'getPrintJobs',
    'createManualPrintJob',
    'createTestPrintJob',
    'claimNextPrintJob',
    'claimPrintJob',
    'completePrintJob',
    'failPrintJob',
    'retryPrintJob',
    'getOrderPrintDocument',
  ]) assert.match(manager, new RegExp(`\\b${apiName}\\b`))

  assert.match(manager, /runClaimedPrintJob/)
  assert.match(manager, /findAuthorizedPrinterPort/)
  assert.match(manager, /requestPrinterPort/)
  assert.match(manager, /dispatchRawBtBytes/)
  assert.doesNotMatch(manager, /getNewActiveOrderIds/)
  assert.doesNotMatch(manager, /detectedIds/)

  const detectedIdsIndex = app.indexOf('newIds: detectedIds')
  assert.notEqual(detectedIdsIndex, -1)
  const detectionEffectStart = app.lastIndexOf('useEffect(() => {', detectedIdsIndex)
  assert.notEqual(detectionEffectStart, -1)
  const nextEffectStart = app.indexOf('useEffect(() => {', detectedIdsIndex + 1)
  assert.notEqual(nextEffectStart, -1)
  const detectionEffect = app.slice(detectionEffectStart, nextEffectStart)
  assert.match(detectionEffect, /detectedIds/)
  assert.doesNotMatch(detectionEffect, /\bprinting\./)
})

test('Android selects RawBT while Windows and other platforms keep Web Serial', () => {
  assert.equal(getPrintingTransportKind('android'), 'rawbt')
  assert.equal(getPrintingTransportKind('windows'), 'web-serial')
  assert.equal(getPrintingTransportKind('other'), 'web-serial')

  assert.equal(isPrintingTransportSupported('android', undefined), true)
  assert.equal(isPrintingTransportSupported('windows', undefined), false)
  assert.equal(isPrintingTransportSupported('windows', { requestPort() {}, getPorts() {} }), true)

  assert.match(manager, /transportKind === 'rawbt'/)
  assert.match(manager, /dispatchRawBtBytes\(bytes\)/)
})

test('Android RawBT enables MPT-II bitmap rendering while Web Serial keeps native text rendering', () => {
  const start = manager.indexOf('const executeClaimedJob = useCallback')
  assert.notEqual(start, -1)
  const end = manager.indexOf('const saveStationSettings', start)
  assert.notEqual(end, -1)
  const block = manager.slice(start, end)

  assert.match(
    block,
    /renderer:\s*\(document,\s*options\)\s*=>\s*renderEscPos58mm\(document,\s*\{[\s\S]*\.\.\.options,[\s\S]*compatibilityMode:\s*isRawBt\s*\?\s*'mpt2-bitmap'\s*:\s*null[\s\S]*\}\)/,
  )
})

test('automatic claim guard blocks duplicate or unsafe consumption states', () => {
  const base = {
    authenticated: true,
    isOnline: true,
    supported: true,
    visible: true,
    browserOnline: true,
    busyJobId: null,
    printerBlocked: false,
    station: { isPrimary: true, autoPrintEnabled: true },
  }
  assert.equal(canConsumeAutomaticPrintJob(base), true)
  for (const override of [
    { authenticated: false },
    { isOnline: false },
    { supported: false },
    { visible: false },
    { browserOnline: false },
    { busyJobId: 'job-running' },
    { printerBlocked: true },
    { station: null },
    { station: { isPrimary: false, autoPrintEnabled: true } },
    { station: { isPrimary: true, autoPrintEnabled: false } },
  ]) assert.equal(canConsumeAutomaticPrintJob({ ...base, ...override }), false)

  assert.match(manager, /canConsumeAutomaticPrintJob\(\{/)
  assert.match(manager, /updateBlocked\(false\)/)
})

test('second copy resumes the existing partial job explicitly without creating a replacement job', () => {
  const start = manager.indexOf('const printSecondCopy = useCallback')
  assert.notEqual(start, -1)
  const end = manager.indexOf('const retryJob = useCallback', start)
  assert.notEqual(end, -1)
  const block = manager.slice(start, end)

  assert.match(block, /copiesRequested\) !== 2|copiesRequested !== 2/)
  assert.match(block, /copiesPrinted\) !== 1|copiesPrinted !== 1/)
  assert.match(block, /claimPrintJob\(job\.id, station\.id\)/)
  assert.match(block, /executeClaimedJob\(claimed\.job, port/)
  assert.doesNotMatch(block, /createManualPrintJob/)
  assert.match(manager, /\bprintSecondCopy,\s*\n/)
})

test('printing manager centralizes approved poll and heartbeat cadences', () => {
  assert.match(manager, /export const PRINT_JOB_POLL_MS = 2_000/)
  assert.match(manager, /export const PRINT_STATE_POLL_MS = 5_000/)
  assert.match(manager, /export const STATION_HEARTBEAT_MS = 15_000/)
  assert.match(manager, /printerBlocked/)
  assert.match(manager, /busyJobId/)
})

test('App mounts one printing manager and passes it to Orders without changing order sync detection', () => {
  assert.match(app, /import \{ usePrintingManager \} from '\.\/printing\/usePrintingManager'/)
  const hookCalls = app.match(/usePrintingManager\(/g) || []
  assert.equal(hookCalls.length, 1)
  assert.match(app, /const printing = usePrintingManager\(/)
  assert.match(app, /<Orders[\s\S]*printing=\{printing\}/)

  assert.match(app, /getNew(?:Active|Operational)OrderIds/)
  assert.match(app, /detectedIds/)
  assert.match(app, /const DATA_COLLECTIONS = \['clients', 'products', 'orders', 'tableTabs', 'movements', 'financeSettings'\]/)
  assert.doesNotMatch(app, /DATA_COLLECTIONS = \[[^\]]*print/i)
})
