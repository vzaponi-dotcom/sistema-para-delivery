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
