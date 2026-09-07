import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canConsumeAutomaticPrintJob,
  getPrintingTransportKind,
  getRendererCompatibilityMode,
  isPrintingTransportSupported,
} from './usePrintingManager.js'

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

test('Windows uses QZ and both MPT-II local transports use bitmap rendering', () => {
  assert.equal(getPrintingTransportKind('windows'), 'qz')
  assert.equal(getPrintingTransportKind('android'), 'rawbt')
  assert.equal(getPrintingTransportKind('other'), 'web-serial')
  assert.equal(getRendererCompatibilityMode('qz'), 'mpt2-bitmap')
  assert.equal(getRendererCompatibilityMode('rawbt'), 'mpt2-bitmap')
  assert.equal(getRendererCompatibilityMode('web-serial'), null)
  assert.equal(isPrintingTransportSupported('windows', undefined), true)
})

test('automatic consumer does not claim while local transport is not ready', () => {
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer({ transportReady: false })), false)
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer()), true)
})
