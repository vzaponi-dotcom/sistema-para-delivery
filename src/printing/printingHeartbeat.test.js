import assert from 'node:assert/strict'
import test from 'node:test'
import * as printingManager from './usePrintingManager.js'

const primaryWindows = {
  id: 'kitchen',
  platform: 'windows',
  isPrimary: true,
  autoPrintEnabled: false,
}

test('only the authenticated online primary Windows QZ station sends physical heartbeat', () => {
  assert.equal(typeof printingManager.canSendPrintStationHeartbeat, 'function')
  const eligible = {
    authenticated: true,
    isOnline: true,
    browserOnline: true,
    isQz: true,
    station: primaryWindows,
  }

  assert.equal(printingManager.canSendPrintStationHeartbeat(eligible), true)
  assert.equal(printingManager.canSendPrintStationHeartbeat({ ...eligible, authenticated: false }), false)
  assert.equal(printingManager.canSendPrintStationHeartbeat({ ...eligible, isOnline: false }), false)
  assert.equal(printingManager.canSendPrintStationHeartbeat({ ...eligible, browserOnline: false }), false)
  assert.equal(printingManager.canSendPrintStationHeartbeat({ ...eligible, isQz: false }), false)
  assert.equal(printingManager.canSendPrintStationHeartbeat({ ...eligible, station: { ...primaryWindows, isPrimary: false } }), false)
  assert.equal(printingManager.canSendPrintStationHeartbeat({ ...eligible, station: { ...primaryWindows, platform: 'android' } }), false)
})

test('QZ heartbeat distinguishes QZ connectivity from configured printer readiness', () => {
  assert.equal(typeof printingManager.buildPrintStationHeartbeatHealth, 'function')
  assert.deepEqual(printingManager.buildPrintStationHeartbeatHealth({
    qzActive: true,
    transportReady: false,
    configuredPrinterName: null,
  }), { qzReady: true, printerReady: false })
  assert.deepEqual(printingManager.buildPrintStationHeartbeatHealth({
    qzActive: true,
    transportReady: true,
    configuredPrinterName: 'Impressora pedido',
  }), { qzReady: true, printerReady: true })
  assert.deepEqual(printingManager.buildPrintStationHeartbeatHealth({
    qzActive: false,
    transportReady: true,
    configuredPrinterName: 'Impressora pedido',
  }), { qzReady: false, printerReady: false })
})
