import test from 'node:test'
import assert from 'node:assert/strict'

test('printing public entry stays minimal', async () => {
  const mod = await import('./index.js')
  assert.deepEqual(Object.keys(mod).sort(), [
    'DEFAULT_PRINT_QUEUE_QUERY',
    'PrintQueue',
    'PrintingOverlays',
    'PrintingSettingsContent',
    'printingPolicy',
    'stationConfigurationPolicy',
    'stationPrimaryPolicy',
    'usePrintingManager',
  ].sort())
})


test('printing public entry does not expose internal helpers by name', async () => {
  const mod = await import('./index.js')
  for (const internal of [
    'canConsumeAutomaticPrintJob',
    'canPresentSecondCopyPrompt',
    'deriveRecoveryView',
    'renderEscPos58mm',
    'getPrintJobs',
    'createQzTransport',
  ]) assert.equal(Object.hasOwn(mod, internal), false, internal)
})
