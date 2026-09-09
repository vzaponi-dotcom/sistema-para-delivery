import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canExecuteSecondCopy,
  canPresentSecondCopyPrompt,
  canConsumeAutomaticPrintJob,
  getPrintingTransportKind,
  getRendererCompatibilityMode,
  isPrintingTransportSupported,
} from './usePrintingManager.js'

const awaitingSecondCopyJob = {
  status: 'awaiting_second_copy',
  copiesRequested: 2,
  copiesPrinted: 1,
}

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

test('Windows uses QZ, Android keeps RawBT, and only fallback platforms depend on Web Serial', () => {
  assert.equal(getPrintingTransportKind('windows'), 'qz')
  assert.equal(getPrintingTransportKind('android'), 'rawbt')
  assert.equal(getPrintingTransportKind('other'), 'web-serial')
  assert.equal(getRendererCompatibilityMode('qz'), 'mpt2-bitmap')
  assert.equal(getRendererCompatibilityMode('rawbt'), 'mpt2-bitmap')
  assert.equal(getRendererCompatibilityMode('web-serial'), null)

  assert.equal(isPrintingTransportSupported('windows', undefined), true)
  assert.equal(isPrintingTransportSupported('android', undefined), true)
  assert.equal(isPrintingTransportSupported('other', undefined), false)
  assert.equal(isPrintingTransportSupported('other', { requestPort() {}, getPorts() {} }), true)
})

test('automatic consumer does not claim while QZ or another local transport is not ready', () => {
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer({ transportReady: false })), false)
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer()), true)
})

test('transport support alone cannot bypass station and local-readiness guards', () => {
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer({
    supported: true,
    transportReady: false,
    station: { isPrimary: true, autoPrintEnabled: true },
  })), false)
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer({
    transportReady: true,
    station: { isPrimary: false, autoPrintEnabled: true },
  })), false)
  assert.equal(canConsumeAutomaticPrintJob(readyAutomaticConsumer({
    transportReady: true,
    station: { isPrimary: true, autoPrintEnabled: false },
  })), false)
})

test('the primary QZ station can execute an awaiting second copy', () => {
  assert.equal(canExecuteSecondCopy({
    isQz: true,
    station: { isPrimary: true, platform: 'windows' },
    job: awaitingSecondCopyJob,
  }), true)
})

test('non-QZ and secondary stations cannot execute an awaiting second copy', () => {
  assert.equal(canExecuteSecondCopy({
    isQz: false,
    station: { isPrimary: true, platform: 'android' },
    job: awaitingSecondCopyJob,
  }), false)
  assert.equal(canExecuteSecondCopy({
    isQz: true,
    station: { isPrimary: false, platform: 'windows' },
    job: awaitingSecondCopyJob,
  }), false)
})

test('only an unacknowledged awaiting copy can present the second-copy prompt on primary QZ', () => {
  const primaryQz = { isQz: true, transportReady: true, printerBlocked: false, station: { isPrimary: true, platform: 'windows' } }

  assert.equal(canPresentSecondCopyPrompt({ ...primaryQz, job: awaitingSecondCopyJob }), true)
  assert.equal(canPresentSecondCopyPrompt({
    ...primaryQz,
    job: { ...awaitingSecondCopyJob, secondCopyPromptedAt: '2026-09-08T12:00:00.000Z' },
  }), false)
  assert.equal(canPresentSecondCopyPrompt({
    isQz: true,
    transportReady: true,
    printerBlocked: false,
    station: { isPrimary: false, platform: 'windows' },
    job: awaitingSecondCopyJob,
  }), false)
})

test('an unready or blocked primary QZ station cannot present the physical second-copy prompt', () => {
  const station = { isPrimary: true, platform: 'windows' }

  assert.equal(canPresentSecondCopyPrompt({
    isQz: true,
    transportReady: false,
    printerBlocked: false,
    station,
    job: awaitingSecondCopyJob,
  }), false)
  assert.equal(canPresentSecondCopyPrompt({
    isQz: true,
    transportReady: true,
    printerBlocked: true,
    station,
    job: awaitingSecondCopyJob,
  }), false)
})
