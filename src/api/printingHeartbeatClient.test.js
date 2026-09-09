import assert from 'node:assert/strict'
import test from 'node:test'
import * as printingClient from './client.js'

test('heartbeatPrintStation posts only the station health payload to the central API', async () => {
  assert.equal(typeof printingClient.heartbeatPrintStation, 'function')
  const originalFetch = globalThis.fetch
  let captured = null
  globalThis.fetch = async (path, options) => {
    captured = { path, options }
    return new Response(JSON.stringify({
      station: {
        id: 'kitchen',
        health: { online: true, qzReady: true, printerReady: true, ready: true, automaticReady: true },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  try {
    const response = await printingClient.heartbeatPrintStation('kitchen', {
      qzReady: true,
      printerReady: true,
    })
    assert.equal(captured.path, '/api/printing/stations/kitchen/heartbeat')
    assert.equal(captured.options.method, 'POST')
    assert.deepEqual(JSON.parse(captured.options.body), { qzReady: true, printerReady: true })
    assert.equal(response.station.health.ready, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})
