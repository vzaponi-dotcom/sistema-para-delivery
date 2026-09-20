import assert from 'node:assert/strict'
import test from 'node:test'
import { canSendPrintStationHeartbeat } from '../domains/printing/domain/printingEligibility.js'
import * as printingManager from '../domains/printing/application/usePrintingManager.js'

const primaryWindows = {
  id: 'kitchen',
  platform: 'windows',
  isPrimary: true,
  autoPrintEnabled: false,
}

test('only the authenticated online primary Windows QZ station sends physical heartbeat', () => {
  assert.equal(typeof canSendPrintStationHeartbeat, 'function')
  const eligible = {
    authenticated: true,
    isOnline: true,
    browserOnline: true,
    isQz: true,
    station: primaryWindows,
  }

  assert.equal(canSendPrintStationHeartbeat(eligible), true)
  assert.equal(canSendPrintStationHeartbeat({ ...eligible, authenticated: false }), false)
  assert.equal(canSendPrintStationHeartbeat({ ...eligible, isOnline: false }), false)
  assert.equal(canSendPrintStationHeartbeat({ ...eligible, browserOnline: false }), false)
  assert.equal(canSendPrintStationHeartbeat({ ...eligible, isQz: false }), false)
  assert.equal(canSendPrintStationHeartbeat({ ...eligible, station: { ...primaryWindows, isPrimary: false } }), false)
  assert.equal(canSendPrintStationHeartbeat({ ...eligible, station: { ...primaryWindows, platform: 'android' } }), false)
})

test('QZ heartbeat distinguishes QZ connectivity from configured printer readiness', () => {
  assert.equal(typeof printingManager.buildPrintStationHeartbeatHealth, 'function')
  assert.deepEqual(printingManager.buildPrintStationHeartbeatHealth({
    qzActive: true,
    transportReady: false,
    configuredPrinterName: null,
  }), { qzReady: true, printerReady: false, physicalState: 'verifying', physicalStatusText: null, physicalStatusCode: null })
  assert.deepEqual(printingManager.buildPrintStationHeartbeatHealth({
    qzActive: true,
    transportReady: true,
    configuredPrinterName: 'Impressora pedido',
    printerHealth: { state: 'ready', statusText: 'OK', statusCode: 0 },
  }), { qzReady: true, printerReady: true, physicalState: 'ready', physicalStatusText: 'OK', physicalStatusCode: 0 })
  assert.equal(printingManager.buildPrintStationHeartbeatHealth({
    qzActive: true,
    transportReady: true,
    configuredPrinterName: 'Impressora pedido',
    printerHealth: { state: 'printer_offline', statusText: 'Offline', statusCode: 7 },
  }).printerReady, false)
  assert.deepEqual(printingManager.buildPrintStationHeartbeatHealth({
    qzActive: false,
    transportReady: true,
    configuredPrinterName: 'Impressora pedido',
  }), { qzReady: false, printerReady: false, physicalState: 'verifying', physicalStatusText: null, physicalStatusCode: null })
})
