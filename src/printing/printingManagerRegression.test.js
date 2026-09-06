import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { canConsumeAutomaticPrintJob } from './usePrintingManager.js'

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
  assert.doesNotMatch(manager, /getNewActiveOrderIds/)
  assert.doesNotMatch(manager, /detectedIds/)
  assert.doesNotMatch(app, /detectedIds[\s\S]{0,500}printing\./)
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
