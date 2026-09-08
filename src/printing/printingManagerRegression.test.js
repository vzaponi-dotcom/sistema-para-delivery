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

test('Android uses RawBT, Windows uses QZ, and other platforms keep Web Serial fallback', () => {
  assert.equal(getPrintingTransportKind('android'), 'rawbt')
  assert.equal(getPrintingTransportKind('windows'), 'qz')
  assert.equal(getPrintingTransportKind('other'), 'web-serial')

  assert.equal(isPrintingTransportSupported('android', undefined), true)
  assert.equal(isPrintingTransportSupported('windows', undefined), true)
  assert.equal(isPrintingTransportSupported('other', undefined), false)
  assert.equal(isPrintingTransportSupported('other', { requestPort() {}, getPorts() {} }), true)

  assert.match(manager, /transportKind === 'rawbt'/)
  assert.match(manager, /dispatchRawBtBytes\(bytes\)/)
})

test('QZ and RawBT use MPT-II bitmap rendering while Web Serial keeps native text rendering', () => {
  const start = manager.indexOf('const executeClaimedJob = useCallback')
  assert.notEqual(start, -1)
  const end = manager.indexOf('const saveStationSettings', start)
  assert.notEqual(end, -1)
  const block = manager.slice(start, end)

  assert.match(block, /compatibilityMode:\s*getRendererCompatibilityMode\(transportKind\)/)
  assert.match(block, /printQzRawBytes\(qz, configuredPrinterNameRef\.current, bytes\)/)
  assert.match(block, /dispatchRawBtBytes\(bytes\)/)
  assert.match(block, /writeSerialBytes\(selectedPort, bytes, MTP5_PROFILE\.serial\)/)
})

test('Windows QZ lifecycle configures signed security and exposes explicit local queue setup', () => {
  assert.match(manager, /import qz from 'qz-tray'/)
  assert.match(manager, /getQzCertificate/)
  assert.match(manager, /signQzPayload/)
  for (const qzName of [
    'configureQzSecurity',
    'ensureQzConnected',
    'listQzPrinters',
    'resolveQzPrinter',
    'printQzRawBytes',
  ]) assert.match(manager, new RegExp(`\\b${qzName}\\b`))
  assert.match(manager, /getQzPrinterName/)
  assert.match(manager, /saveQzPrinterName/)

  assert.match(manager, /const \[availablePrinters, setAvailablePrinters\] = useState\(\[\]\)/)
  assert.match(manager, /const \[configuredPrinterName, setConfiguredPrinterName\] = useState\(null\)/)
  assert.match(manager, /const \[transportReady, setTransportReady\] = useState\(/)
  assert.match(manager, /const refreshPrinters = useCallback\(async \(\) =>/)
  assert.match(manager, /const selectPrinter = useCallback\(async \(printerName\) =>/)
  assert.match(manager, /configureQzSecurity\(\{[\s\S]*qzApi:\s*qz,[\s\S]*getCertificate:\s*getQzCertificate,[\s\S]*signPayload:\s*signQzPayload/)
  assert.match(manager, /ensureQzConnected\(qz\)/)
  assert.match(manager, /resolveQzPrinter\(qz, savedPrinterName\)/)
  assert.match(manager, /saveQzPrinterName\(globalThis\.localStorage, stationId, selectedPrinter\)/)

  const explicitPortStart = manager.indexOf('const getExplicitPort = useCallback')
  assert.notEqual(explicitPortStart, -1)
  const explicitPortEnd = manager.indexOf('const executeClaimedJob = useCallback', explicitPortStart)
  assert.notEqual(explicitPortEnd, -1)
  const explicitPort = manager.slice(explicitPortStart, explicitPortEnd)
  assert.match(explicitPort, /transportKind === 'qz'/)
  assert.match(explicitPort, /transportReadyRef\.current/)
})

test('automatic claim guard blocks duplicate, unready, or unsafe consumption states', () => {
  const base = {
    authenticated: true,
    isOnline: true,
    supported: true,
    visible: true,
    browserOnline: true,
    busyJobId: null,
    printerBlocked: false,
    transportReady: true,
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
    { transportReady: false },
    { station: null },
    { station: { isPrimary: false, autoPrintEnabled: true } },
    { station: { isPrimary: true, autoPrintEnabled: false } },
  ]) assert.equal(canConsumeAutomaticPrintJob({ ...base, ...override }), false)

  assert.match(manager, /canConsumeAutomaticPrintJob\(\{[\s\S]*transportReady:\s*transportReadyRef\.current/)
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
  assert.match(app, /const DATA_COLLECTIONS = \['clients', 'products', 'orders', 'tables', 'tableTabs', 'movements', 'financeSettings'\]/)
  assert.doesNotMatch(app, /DATA_COLLECTIONS = \[[^\]]*print/i)
})
