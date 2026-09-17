import assert from 'node:assert/strict'
import test from 'node:test'

import { createPrintingSettingsAdapter } from './printingSettingsAdapter.js'

test('printing adapter routes versioned policy operations through policy editing with the active station scope', async () => {
  const calls = []
  const resources = {
    printingPolicy: { status: 'ready' },
    'stationConfiguration:station-7': { status: 'ready' },
    stationPrimary: { status: 'ready' },
  }
  const policyEditing = {
    resources,
    load: async (...args) => { calls.push(['load', ...args]); return true },
    edit: (...args) => { calls.push(['edit', ...args]); return true },
    save: async (...args) => { calls.push(['save', ...args]); return true },
    discard: (...args) => { calls.push(['discard', ...args]); return true },
    reconcile: async (...args) => { calls.push(['reconcile', ...args]); return true },
    reviewConflict: async (...args) => { calls.push(['review', ...args]); return { resource: args[0] } },
  }
  const printing = {
    localStation: { id: 'station-7' },
    selectPrinter: async (name) => { calls.push(['selectPrinter', name]); return true },
    refreshPrinters: async () => { calls.push(['refreshPrinters']); return true },
    testPrint: async () => { calls.push(['testPrint']); return true },
  }
  const adapter = createPrintingSettingsAdapter({ policyEditing, printing })

  assert.equal(adapter.policyState(), resources.printingPolicy)
  assert.equal(adapter.stationState(), resources['stationConfiguration:station-7'])
  assert.equal(adapter.primaryState(), resources.stationPrimary)
  assert.equal(await adapter.loadPolicy(), true)
  assert.deepEqual(await adapter.loadStation(), [true, true])
  assert.equal(await adapter.reloadPolicy(), true)
  assert.equal(await adapter.reloadStation(), true)
  assert.equal(adapter.editPolicy({ orderDefaultCopies: 2 }), true)
  assert.equal(await adapter.savePolicy(), true)
  assert.equal(adapter.discardPolicy(), true)
  assert.equal(await adapter.reconcilePolicy(), true)
  assert.equal(adapter.editStation({ name: 'Cozinha' }), true)
  assert.equal(await adapter.saveStation(), true)
  assert.equal(adapter.discardStation(), true)
  assert.equal(await adapter.reconcileStation(), true)
  assert.deepEqual(await adapter.reviewPolicy(), { resource: 'printingPolicy' })
  assert.deepEqual(await adapter.reviewStation(), { resource: 'stationConfiguration' })
  assert.deepEqual(await adapter.reviewPrimary(), { resource: 'stationPrimary' })
  assert.equal(await adapter.makePrimary(), true)
  assert.equal(await adapter.savePrinter('Cozinha'), true)
  assert.equal(await adapter.refreshPrinters(), true)
  assert.equal(await adapter.testPrint(), true)

  assert.deepEqual(calls, [
    ['load', 'printingPolicy'],
    ['load', 'stationConfiguration', 'station-7'],
    ['load', 'stationPrimary'],
    ['load', 'printingPolicy'],
    ['load', 'stationConfiguration', 'station-7'],
    ['edit', 'printingPolicy', { orderDefaultCopies: 2 }],
    ['save', 'printingPolicy'],
    ['discard', 'printingPolicy'],
    ['reconcile', 'printingPolicy'],
    ['edit', 'stationConfiguration', { name: 'Cozinha' }, 'station-7'],
    ['save', 'stationConfiguration', 'station-7'],
    ['discard', 'stationConfiguration', 'station-7'],
    ['reconcile', 'stationConfiguration', 'station-7'],
    ['review', 'printingPolicy'],
    ['review', 'stationConfiguration', 'station-7'],
    ['review', 'stationPrimary'],
    ['edit', 'stationPrimary', { primaryStationId: 'station-7' }],
    ['save', 'stationPrimary'],
    ['selectPrinter', 'Cozinha'],
    ['refreshPrinters'],
    ['testPrint'],
  ])
})

test('printing adapter requires a station before station-scoped or primary operations', async () => {
  const calls = []
  const adapter = createPrintingSettingsAdapter({
    policyEditing: {
      resources: {},
      load: async (...args) => { calls.push(args); return true },
      edit: (...args) => { calls.push(args); return true },
      save: async (...args) => { calls.push(args); return true },
    },
    printing: { localStation: {} },
  })

  assert.equal(await adapter.loadStation(), false)
  assert.equal(adapter.editStation({ name: 'Cozinha' }), false)
  assert.equal(await adapter.makePrimary(), false)
  assert.deepEqual(calls, [])
})
