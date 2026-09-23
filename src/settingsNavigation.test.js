import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'

import { createPrintingSettingsAdapter } from './app/surfaces/settings/printingSettingsAdapter.js'
import { buttonNamed, nodeText, workspaceHarness } from './test-support/renderWorkspace.js'

const response = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
})

test('printing adapter keeps canonical resources independent without local remote state', async () => {
  const calls = []
  const resources = {
    printingPolicy: { status: 'ready', confirmed: { data: { orderDefaultCopies: 1, tableTabDefaultCopies: 2 } } },
    'stationConfiguration:station-1': { status: 'ready', confirmed: { data: { name: 'Cozinha', platform: 'windows', autoPrintEnabled: false } } },
    stationPrimary: { status: 'ready', confirmed: { data: { primaryStationId: null } } },
  }
  const policyEditing = {
    resources,
    edit(resource, data, scopeId) { calls.push(['edit', resource, scopeId, data]); return true },
    save(resource, scopeId) { calls.push(['save', resource, scopeId]); return true },
  }
  const localCalls = []
  const printing = {
    localStation: { id: 'station-1' },
    selectPrinter(name) { localCalls.push(name); return name },
  }
  const adapter = createPrintingSettingsAdapter({ policyEditing, printing })
  adapter.editPolicy({ orderDefaultCopies: 2, tableTabDefaultCopies: 2 })
  await adapter.savePolicy()
  await adapter.savePrinter('Fila B')
  assert.deepEqual(calls.map((call) => call.slice(0, 3)), [
    ['edit', 'printingPolicy', undefined],
    ['save', 'printingPolicy', undefined],
  ])
  assert.deepEqual(localCalls, ['Fila B'])
})

test('printing route loads policy station configuration and primary through businessSettings', async (t) => {
  const h = await workspaceHarness(t)
  const [{ default: SettingsSurface }, { PolicyEditingContext }] = await Promise.all([
    h.load('/src/app/surfaces/settings/SettingsSurface.jsx'),
    h.load('/src/app/policy-editing/policyEditingContext.js'),
  ])
  const loads = []
  const policyEditing = {
    resources: {}, load(resource, scopeId) { loads.push([resource, scopeId]); return true },
    edit() {}, save() {}, discard() {}, reconcile() {}, reviewConflict() {},
    activeConflict: null, acceptActiveConflict() {}, dismissActiveConflict() {}, reset() {},
  }
  const printing = { transportKind: 'queue-only', localStation: { id: 'station-1', name: 'Tablet', platform: 'android' }, jobs: [] }
  await h.render(PolicyEditingContext.Provider, { value: policyEditing, children: React.createElement(SettingsSurface, {
    section: 'settings-printing', printing,
    granted: new Set(['printing.settings.view', 'printing.station.view']),
    implemented: new Set(['settings-printing']), onNavigate() {},
    soundEnabled: true, onSoundEnabledChange() {}, onSuccessMessage() {},
  }) })
  await act(async () => new Promise((resolve) => setImmediate(resolve)))
  assert.deepEqual(loads, [
    ['printingPolicy', undefined],
    ['stationConfiguration', 'station-1'],
    ['stationPrimary', undefined],
  ])
})

test('physical test or pending job does not block navigation', async (t) => {
  const h = await workspaceHarness(t)
  const { useNavigationController } = await h.load('/src/app/navigation/useNavigationController.js')
  const api = React.createRef()
  const Probe = React.forwardRef(function Probe(_props, ref) {
    const navigation = useNavigationController({
      granted: new Set(['orders.view', 'clients.view']),
      implemented: new Set(['orders', 'clients']),
      checkoutPending: false,
      dirtyOrder: false,
      onDiscardOrder() {},
      onFeedback() {},
    })
    React.useImperativeHandle(ref, () => navigation, [navigation])
    return React.createElement('output', null, `${navigation.activeTab}:job-pending`)
  })
  const renderer = await h.render(Probe, { ref: api })
  await act(async () => api.current.requestNavigation('clients'))
  assert.equal(nodeText(renderer.root.findByType('output')), 'clients:job-pending')
})

test('theme and sound stay local and synchronized with their existing application sources', async (t) => {
  const h = await workspaceHarness(t)
  h.document.documentElement.dataset = {}
  const { ThemeProvider } = await h.load('/src/app/shell/theme/ThemeProvider.jsx')
  const { default: App } = await h.load('/src/App.jsx')
  globalThis.fetch = async (path) => {
    const url = String(path)
    if (url === '/api/auth/session') return response({ authenticated: true })
    if (url === '/api/bootstrap') return response({ tables: [], tableTabs: [], orders: [], clients: [], products: [], movements: [], financeSettings: null })
    if (url === '/api/printing/stations') return response({ stations: [{ id: 'test-station', platform: 'other', autoPrintEnabled: false }] })
    if (url.startsWith('/api/printing/jobs?')) return response({ jobs: [] })
    if (url === '/api/printing/jobs/summary') return response({ summary: { safeBacklog: 0 } })
    throw new Error(`Unexpected request: ${url}`)
  }
  const Root = () => React.createElement(ThemeProvider, null, React.createElement(App))
  const { renderer } = await h.renderAdminApp(Root)
  await act(async () => h.window.dispatchEvent(Object.assign(new Event('app:navigate'), { detail: 'settings-device' })))
  await act(async () => buttonNamed(renderer.root, 'Escuro').props.onClick())
  assert.equal(h.window.localStorage.getItem('delivery-theme'), 'dark')
  const sound = renderer.root.findByProps({ role: 'switch', 'aria-label': 'Som de novos pedidos' })
  await act(async () => sound.props.onClick())
  assert.equal(h.window.localStorage.getItem('kitchen-sound-enabled'), 'false')
  await act(async () => h.window.dispatchEvent(Object.assign(new Event('app:navigate'), { detail: 'orders' })))
  assert.equal(buttonNamed(renderer.root, 'Som desligado').props['aria-pressed'], false)
})
