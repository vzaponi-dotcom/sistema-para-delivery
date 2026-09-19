import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolvePrintCopies } from '../../../../shared/printContextPolicy.js'

test('printing domain owns pure transport and physical eligibility rules', async () => {
  const eligibility = await import('./printingEligibility.js')

  assert.equal(eligibility.getPrintingTransportKind('windows'), 'qz')
  assert.equal(eligibility.getPrintingTransportKind('android'), 'queue-only')
  assert.equal(eligibility.getPrintingTransportKind('other'), 'queue-only')
  assert.equal(eligibility.getRendererCompatibilityMode('qz'), 'mpt2-bitmap')
  assert.equal(eligibility.getRendererCompatibilityMode('queue-only'), null)
  assert.equal(eligibility.isPrintingTransportSupported('windows'), true)
  assert.equal(eligibility.isPrintingTransportSupported('android'), false)

  const ready = {
    authenticated: true,
    isOnline: true,
    supported: true,
    visible: true,
    browserOnline: true,
    busyJobId: null,
    printerBlocked: false,
    transportReady: true,
    qzConnected: true,
    physicalReady: true,
    isQz: true,
    station: { isPrimary: true, autoPrintEnabled: true, recoveryState: 'normal' },
  }
  assert.equal(eligibility.canConsumeAutomaticPrintJob(ready), true)
  assert.equal(eligibility.canConsumeAutomaticPrintJob({ ...ready, physicalReady: false }), false)
  assert.equal(eligibility.canConsumeAutomaticPrintJob({ ...ready, station: { ...ready.station, isPrimary: false } }), false)
})

test('printing domain owns recovery and second-copy rules without changing behavior', async () => {
  const recovery = await import('./printRecovery.js')
  const secondCopy = await import('./secondCopy.js')

  assert.deepEqual(recovery.deriveRecoveryView({
    recoveryState: 'pending',
    physicalReady: true,
    safeBacklog: 2,
  }), {
    recoveryState: 'pending',
    recoveryPendingCount: 2,
    recoveryPromptEligible: true,
  })

  const job = {
    id: 'job-2',
    type: 'table-tab',
    status: 'awaiting_second_copy',
    copiesRequested: 2,
    copiesPrinted: 1,
  }
  assert.equal(secondCopy.isSecondCopyPromptEligible(job), true)
  assert.equal(secondCopy.getSecondCopyPromptTitle({
    ...job,
    document: { tableTab: { number: 42 } },
  }), 'Comanda #42')
})

test('printing domain owns station policy and 58mm renderer contracts', async () => {
  const station = await import('./stationPolicy.js')
  const renderer = await import('./rendering/escpos58mm.js')

  assert.equal(station.getDefaultPrintStationName('windows'), 'Cozinha · Windows')
  assert.equal(station.getDefaultPrintStationName('android'), 'Cozinha · Android')
  assert.equal(station.getDefaultPrintStationName('other'), 'Cozinha · Navegador')
  assert.equal(station.isQzPrintStationEligible({ platform: 'windows', qzPrinterName: 'MPT-II' }), true)
  assert.equal(station.isQzPrintStationEligible({ platform: 'android', qzPrinterName: 'MPT-II' }), false)
  assert.equal(typeof renderer.renderEscPos58mm, 'function')
})

test('printing domain source stays free of React, QZ, browser globals and fetch', async () => {
  for (const relative of [
    './printingEligibility.js',
    './printRecovery.js',
    './secondCopy.js',
    './stationPolicy.js',
    './rendering/cp860.js',
    './rendering/mtp5Profile.js',
    './rendering/escpos58mm.js',
    './rendering/manualPrintDocument.js',
    './rendering/pdfOrderRenderer.js',
  ]) {
    const source = await readFile(new URL(relative, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /from ['"]react(?:\/[^'"]*)?['"]|from ['"]qz-tray['"]/)
    assert.doesNotMatch(source, /\bglobalThis\.(?:document|localStorage|sessionStorage|navigator)\b|\bwindow\s*\.|\bnavigator\s*\.|\blocalStorage\s*\.|\bsessionStorage\s*\.|\bfetch\s*\(/)
  }
})

test('current copy policy stays independent for Local without table and table-linked orders', () => {
  assert.equal(resolvePrintCopies({
    jobType: 'order',
    customerIdentityType: 'local',
    tableTabId: null,
    policy: { orderDefaultCopies: 2, tableTabDefaultCopies: 1 },
  }), 2)

  assert.equal(resolvePrintCopies({
    jobType: 'order',
    customerIdentityType: 'table',
    tableTabId: 'tab-1',
    policy: { orderDefaultCopies: 1, tableTabDefaultCopies: 2 },
  }), 2)
})
