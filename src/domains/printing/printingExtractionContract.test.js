import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

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
  assert.equal(existsSync(new URL('./ui/print-queue.css', import.meta.url)), true)
})


test('legacy src/printing tree contains tests only', () => {
  const entries = readdirSync(new URL('../../printing/', import.meta.url), { withFileTypes: true })
  const production = entries
    .filter((entry) => entry.isFile() && !entry.name.endsWith('.test.js'))
    .map((entry) => entry.name)
  assert.deepEqual(production, [])
})

test('C9 keeps direct QZ imports confined without migration scaffolding', () => {
  assert.equal(existsSync(new URL('../../../scripts/architecture/legacy-import-allowlist.json', import.meta.url)), false)
  const checker = readFileSync(new URL('../../../scripts/architecture/check-import-boundaries.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(checker, /qzDirectImports|allowlist/)
})
