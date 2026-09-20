import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

const legacyProductionPaths = [
  '../../printing/cp860.js',
  '../../printing/escpos58mm.js',
  '../../printing/localPrintStation.js',
  '../../printing/manualPrintDocument.js',
  '../../printing/mtp5Profile.js',
  '../../printing/pdfOrderRenderer.js',
  '../../printing/printRecoveryFlow.js',
  '../../printing/secondCopyPromptFlow.js',
  '../../printing/usePrintingManager.js',
  '../../components/PrintingSettings.jsx',
  '../../components/PrintingSettingsContent.jsx',
  '../../pages/PrintQueue.jsx',
  '../../pages/printQueueDetails.js',
  '../../pages/printQueueFilters.js',
  '../../pages/printQueueQuery.js',
  '../../pages/printQueueSummary.js',
]

test('legacy Printing production owners are physically absent', () => {
  const surviving = legacyProductionPaths.filter((path) => existsSync(new URL(path, import.meta.url)))
  assert.deepEqual(surviving, [])
})

test('Printing CSS ownership keeps only the approved locations', () => {
  assert.equal(existsSync(new URL('../../printing/printing.css', import.meta.url)), false)
  assert.equal(existsSync(new URL('../printing/ui/printing.css', import.meta.url)), true)
  assert.equal(existsSync(new URL('../../print-queue.css', import.meta.url)), true)
})
