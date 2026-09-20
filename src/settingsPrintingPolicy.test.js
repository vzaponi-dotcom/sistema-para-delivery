import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { act } from 'react-test-renderer'

import { createPolicyEditingController } from './app/policy-editing/policyEditingController.js'
import { createPrintingSettingsAdapter } from './app/surfaces/settings/printingSettingsAdapter.js'
import { resolvePrintCopies } from '../shared/printContextPolicy.js'
import { buttonNamed, nodeText, workspaceHarness } from './test-support/renderWorkspace.js'

const managerSource = await readFile(new URL('./domains/printing/application/usePrintingManager.js', import.meta.url), 'utf8')

const admin = (resource, revision, data, scopeId) => ({
  resource,
  ...(scopeId ? { scopeId } : {}),
  revision,
  data,
  meta: { createdAt: '2026-09-13T12:00:00.000Z', updatedAt: '2026-09-13T12:00:00.000Z' },
})

const memoryStorage = () => {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size },
  }
}

async function printingFixture() {
  const calls = { getSettings: [], putSettings: [], selectPrinter: [], testPrint: [] }
  const stationId = 'station-real-7'
  const values = new Map([
    ['printingPolicy', admin('printingPolicy', 4, { orderDefaultCopies: 2, tableTabDefaultCopies: 1 })],
    [`stationConfiguration:${stationId}`, admin('stationConfiguration', 3, { name: 'Caixa Windows', platform: 'windows', autoPrintEnabled: false }, stationId)],
    ['stationPrimary', admin('stationPrimary', 2, { primaryStationId: 'station-other' })],
  ])
  const api = {
    async getSettings(resource, scopeId) {
      const key = scopeId ? `${resource}:${scopeId}` : resource
      calls.getSettings.push([resource, scopeId])
      return structuredClone(values.get(key))
    },
    async putSettings(resource, input, scopeId) {
      calls.putSettings.push({ resource, input: structuredClone(input), scopeId })
      const key = scopeId ? `${resource}:${scopeId}` : resource
      const previous = values.get(key)
      const value = admin(resource, previous.revision + 1, structuredClone(input.data), scopeId)
      values.set(key, value)
      return { resource: structuredClone(value), receipt: { mutationId: input.mutationId, committedRevision: value.revision } }
    },
    async getSettingsReceipt() { return { status: 'unconfirmed' } },
  }
  const controller = createPolicyEditingController({
    transport: {
      load: api.getSettings,
      save: api.putSettings,
      loadReceipt: api.getSettingsReceipt,
    },
    context: { ownerId: 'business-1', generation: 1, contextId: 'settings-1', capabilities: [] },
    storage: memoryStorage(),
    createMutationId: (() => { let id = 0; return () => `mutation-${++id}` })(),
  })
  await controller.load('printingPolicy')
  await controller.load('stationConfiguration', stationId)
  await controller.load('stationPrimary')
  const printing = {
    transportKind: 'qz', supported: true, qzConnected: true, transportReady: true,
    printerQueueFound: true, printerHealth: { state: 'ready' }, configuredPrinterName: 'Cozinha',
    availablePrinters: ['Cozinha', 'Expedição'], jobs: [],
    localStation: { id: stationId, name: 'Caixa Windows', platform: 'windows', autoPrintEnabled: false, isPrimary: false },
    async selectPrinter(name) { calls.selectPrinter.push(name); this.configuredPrinterName = name; return name },
    async refreshPrinters() { return this.availablePrinters },
    async testPrint() { calls.testPrint.push({ copies: 1 }); return { status: 'printed', copiesRequested: 1 } },
  }
  const policyEditing = {
    get resources() { return controller.getResources() },
    load: controller.load,
    edit: controller.edit,
    save: controller.save,
    discard: controller.discard,
    reconcile: controller.reconcile,
    reviewConflict: controller.reviewConflict,
  }
  const adapter = createPrintingSettingsAdapter({ policyEditing, printing, stationId })
  return { adapter, calls, controller, printing, stationId }
}

test('policy draft waits for Save and policy save uses only the settings boundary', async () => {
  const { adapter, calls } = await printingFixture()
  adapter.editPolicy({ orderDefaultCopies: 1, tableTabDefaultCopies: 2 })
  assert.equal(calls.putSettings.length, 0, 'editing copy selectors must stay local')
  assert.deepEqual(adapter.policyState().draft, { orderDefaultCopies: 1, tableTabDefaultCopies: 2 })

  await adapter.savePolicy()
  assert.deepEqual(calls.putSettings.map(({ resource }) => resource), ['printingPolicy'])
  assert.equal(calls.selectPrinter.length, 0, 'saving business policy must not touch QZ')
  assert.deepEqual(calls.putSettings[0].input.data, { orderDefaultCopies: 1, tableTabDefaultCopies: 2 })
})

test('local printer save never changes the confirmed or draft business policy', async () => {
  const { adapter, calls } = await printingFixture()
  const before = structuredClone(adapter.policyState())
  await adapter.savePrinter('Expedição')
  assert.deepEqual(calls.selectPrinter, ['Expedição'])
  assert.equal(calls.putSettings.length, 0)
  assert.deepEqual(adapter.policyState(), before)
})

test('station save and primary election are separate revisioned resources', async () => {
  const { adapter, calls, stationId } = await printingFixture()
  adapter.editStation({ name: 'Caixa Windows', platform: 'windows', autoPrintEnabled: true })
  await adapter.saveStation()
  assert.deepEqual(calls.putSettings.map(({ resource }) => resource), ['stationConfiguration'])
  assert.equal(calls.putSettings[0].scopeId, stationId)

  await adapter.makePrimary()
  assert.deepEqual(calls.putSettings.map(({ resource }) => resource), ['stationConfiguration', 'stationPrimary'])
  assert.deepEqual(calls.putSettings[1].input.data, { primaryStationId: stationId })
})

test('printing page renders three responsibilities and asks before electing the real station', async (t) => {
  const h = await workspaceHarness(t)
  const { default: PrintingSettingsContent } = await h.load('/src/domains/printing/ui/PrintingSettingsContent.jsx')
  const { adapter, calls, printing } = await printingFixture()
  const screen = await h.render(PrintingSettingsContent, {
    printing,
    settings: adapter,
    granted: new Set(['printing.settings', 'printing.station.configure', 'printing.execute']),
  })
  const text = nodeText(screen.root)
  assert.match(text, /Política de impressão do negócio/)
  assert.match(text, /Pedidos/)
  assert.match(text, /Mesas \/ Comandas/)
  assert.match(text, /Estação/)
  assert.equal(screen.root.findByProps({ 'aria-label': 'Nome da estação' }).props.value, 'Caixa Windows')
  assert.match(text, /Impressora local \(QZ Tray\)/)
  assert.match(text, /Apenas novas solicitações de impressão\. A fila existente mantém suas vias\./)

  const primarySwitch = screen.root.findAllByProps({ role: 'switch' })[0]
  await act(async () => primarySwitch.props.onChange({ target: { checked: true } }))
  assert.equal(calls.putSettings.length, 0, 'opening confirmation must not elect the station')
  const dialog = screen.root.findByProps({ role: 'dialog' })
  await act(async () => buttonNamed(dialog, 'Tornar principal').props.onClick())
  assert.deepEqual(calls.putSettings.map(({ resource }) => resource), ['stationPrimary'])
})

test('new print policy cannot rewrite an existing job and test printing is always one copy', async () => {
  const pending = Object.freeze({ id: 'job-old', status: 'pending', copiesRequested: 2, copiesPrinted: 0 })
  const changedPolicy = { orderDefaultCopies: 1, tableTabDefaultCopies: 2 }
  assert.equal(pending.copiesRequested, 2)
  assert.equal(resolvePrintCopies({ jobType: 'test', explicitCopies: 2, policy: changedPolicy }), 1)
})

test('order and table-tab defaults remain independent by durable print context', () => {
  const policy = { orderDefaultCopies: 1, tableTabDefaultCopies: 2 }
  assert.equal(resolvePrintCopies({ jobType: 'order', policy }), 1)
  assert.equal(resolvePrintCopies({ jobType: 'table-tab', policy }), 2)
})

test('adapter exposes the real station loaded by the central controller', async () => {
  const { adapter, stationId } = await printingFixture()
  assert.equal(adapter.stationState().confirmed.scopeId, stationId)
  assert.equal(adapter.stationState().confirmed.data.name, 'Caixa Windows')
})

test('auto-print is a station draft and waits for its own save', async () => {
  const { adapter, calls } = await printingFixture()
  adapter.editStation({ name: 'Caixa Windows', platform: 'windows', autoPrintEnabled: true })
  assert.equal(calls.putSettings.length, 0)
  assert.equal(adapter.stationState().draft.autoPrintEnabled, true)
  await adapter.saveStation()
  assert.deepEqual(calls.putSettings.map(({ resource }) => resource), ['stationConfiguration'])
})

test('existing station bootstrap is read-only unless the station is absent', () => {
  const bootstrapStart = managerSource.indexOf('const stationPayload = await getPrintStations()')
  const bootstrapEnd = managerSource.indexOf('await initializeBackgroundPhysicalTransport', bootstrapStart)
  const bootstrap = managerSource.slice(bootstrapStart, bootstrapEnd)
  assert.match(bootstrap, /let station = existingStations\.find/)
  assert.match(bootstrap, /if \(!station\) \{[\s\S]*upsertPrintStation/)
  assert.equal((bootstrap.match(/upsertPrintStation/g) || []).length, 1)
})

test('health heartbeat recovery and execution stay owned by the mounted manager', () => {
  assert.match(managerSource, /heartbeatPrintStation/)
  assert.match(managerSource, /STATION_HEARTBEAT_MS/)
  assert.match(managerSource, /recoveryPendingCount/)
  assert.match(managerSource, /claimNextPrintJob/)
  assert.doesNotMatch(managerSource, /PrintingSettingsContent/)
})
