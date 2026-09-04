import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

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

  assert.match(app, /getNewActiveOrderIds/)
  assert.match(app, /detectedIds/)
  assert.match(app, /const DATA_COLLECTIONS = \['clients', 'products', 'orders', 'tableTabs', 'movements'\]/)
  assert.doesNotMatch(app, /DATA_COLLECTIONS = \[[^\]]*print/i)
})
