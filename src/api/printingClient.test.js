import assert from 'node:assert/strict'
import test from 'node:test'
import * as client from './client.js'
import {
  claimNextPrintJob,
  claimPrintJob,
  completePrintJob,
  createManualPrintJob,
  createTestPrintJob,
  failPrintJob,
  getOrderPrintDocument,
  getPrintJobs,
  getPrintStations,
  makePrimaryPrintStation,
  retryPrintJob,
  upsertPrintStation,
} from './client.js'

const withFetch = async (callback) => {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (...args) => {
    calls.push(args)
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try { await callback(calls) } finally { globalThis.fetch = original }
}

test('central print settings client reads and updates the business default with session credentials', async () => {
  assert.equal(typeof client.getPrintSettings, 'function')
  assert.equal(typeof client.savePrintSettings, 'function')
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (path, options) => {
    calls.push([path, options])
    return Response.json({ settings: { defaultCopies: options.method === 'PUT' ? 1 : 2 } })
  }
  try {
    assert.deepEqual(await client.getPrintSettings(), { settings: { defaultCopies: 2 } })
    assert.deepEqual(await client.savePrintSettings({ defaultCopies: 1 }), { settings: { defaultCopies: 1 } })
    assert.deepEqual(calls.map(([path, options]) => [path, options.method || 'GET', options.credentials]), [
      ['/api/printing/settings', 'GET', 'same-origin'],
      ['/api/printing/settings', 'PUT', 'same-origin'],
    ])
    assert.deepEqual(JSON.parse(calls[1][1].body), { defaultCopies: 1 })
    globalThis.fetch = async () => Response.json({ error: { code: 'INVALID_PRINT_COPIES', message: 'defaultCopies deve ser 1 ou 2.' } }, { status: 400 })
    await assert.rejects(client.savePrintSettings({ defaultCopies: 3 }), { status: 400, code: 'INVALID_PRINT_COPIES' })
  } finally {
    globalThis.fetch = original
  }
})

test('printing client helpers use stable authenticated same-origin routes and encoded ids', async () => {
  await withFetch(async (calls) => {
    await getPrintStations()
    await upsertPrintStation('station 1', { name: 'Tablet', platform: 'android', autoPrintEnabled: true, defaultCopies: 2 })
    await makePrimaryPrintStation('station 1')
    await getPrintJobs({ orderId: 'order 1', limit: 20 })
    await createManualPrintJob('order 1', 2)
    await createTestPrintJob('station 1')
    await claimNextPrintJob('station 1')
    await claimPrintJob('job 1', 'station 1')
    await completePrintJob('job 1', 'station 1', 2)
    await failPrintJob('job 1', 'station 1', { code: 'SERIAL_OPEN_FAILED', message: 'offline', uncertain: false })
    await retryPrintJob('job 1', 'station 1')
    await getOrderPrintDocument('order 1')

    assert.deepEqual(calls.map(([path, options]) => [path, options?.method || 'GET']), [
      ['/api/printing/stations', 'GET'],
      ['/api/printing/stations/station%201', 'PUT'],
      ['/api/printing/stations/station%201/make-primary', 'POST'],
      ['/api/printing/jobs?orderId=order+1&limit=20', 'GET'],
      ['/api/orders/order%201/print-jobs', 'POST'],
      ['/api/printing/test-jobs', 'POST'],
      ['/api/printing/jobs/claim-next', 'POST'],
      ['/api/printing/jobs/job%201/claim', 'POST'],
      ['/api/printing/jobs/job%201/complete', 'POST'],
      ['/api/printing/jobs/job%201/fail', 'POST'],
      ['/api/printing/jobs/job%201/retry', 'POST'],
      ['/api/orders/order%201/print-document', 'GET'],
    ])

    assert.deepEqual(JSON.parse(calls[1][1].body), { name: 'Tablet', platform: 'android', autoPrintEnabled: true, defaultCopies: 2 })
    assert.deepEqual(JSON.parse(calls[4][1].body), { copies: 2 })
    assert.deepEqual(JSON.parse(calls[5][1].body), { stationId: 'station 1' })
    assert.deepEqual(JSON.parse(calls[8][1].body), { stationId: 'station 1', copiesPrinted: 2 })
    assert.deepEqual(JSON.parse(calls[9][1].body), { stationId: 'station 1', code: 'SERIAL_OPEN_FAILED', message: 'offline', uncertain: false })
  })
})
