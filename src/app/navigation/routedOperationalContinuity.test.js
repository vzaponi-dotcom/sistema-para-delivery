import assert from 'node:assert/strict'
import test from 'node:test'
import { act } from 'react-test-renderer'

import { workspaceHarness, nodeText } from '../test-support/renderWorkspace.js'
import { authenticatedSession, effectivePaymentConfig } from '../test-support/appSessionFixtures.js'

const response = (data) => ({ ok: true, status: 200, json: async () => structuredClone(data) })

test('Task 6 characterization: direct Router cycles preserve query state without leaking global effects', async (t) => {
  const h = await workspaceHarness(t)
  const requests = []

  globalThis.fetch = async (path) => {
    requests.push(String(path))
    if (path === '/api/auth/session') return response(authenticatedSession)
    if (path === '/api/bootstrap') return response({
      tables: [], tableTabs: [], orders: [], clients: [], products: [],
      movements: [], financeSettings: null, effectiveBusinessConfig: effectivePaymentConfig,
    })
    if (String(path).startsWith('/api/settings/effective')) return response(effectivePaymentConfig)
    if (path === '/api/printing/stations') return response({
      stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }],
      primary: { resource: 'stationPrimary', revision: 1, data: { primaryStationId: null }, meta: {} },
    })
    if (path === '/api/printing/jobs?limit=100') return response({ jobs: [] })
    if (path === '/api/printing/jobs/summary') return response({ summary: { safeBacklog: 0 } })
    if (path === '/api/printing/settings') return response({
      settings: { resource: 'printingPolicy', revision: 1, data: { orderDefaultCopies: 1, tableTabDefaultCopies: 1 }, meta: {} },
    })
    if (path === '/api/orders') return response({ orders: [] })
    throw new Error(`Unexpected request: ${path}`)
  }

  const { default: App } = await h.load('/src/App.jsx')
  const { renderer, router } = await h.renderAdminApp(App, {}, {
    createNodeMock: (element) => element.props.className?.includes('app-content')
      ? { focus: () => h.recordFocus() }
      : element.props.role === 'combobox' ? { focus() {} } : {},
  })

  const baseline = h.activitySnapshot({ ignoreFocus: true })

  const search = renderer.root.findByProps({ placeholder: 'Buscar cliente, pedido, produto ou tipo' })
  await act(async () => search.props.onChange({ target: { value: 'maria' } }))

  const paths = ['/clientes', '/comandas', '/configuracoes/impressao', '/pedidos']
  let steady = null
  for (let cycle = 0; cycle < 5; cycle += 1) {
    for (const path of paths) await act(async () => { await router.navigate(path) })
    const activity = h.activitySnapshot({ ignoreFocus: true })
    assert.ok(activity.listeners <= baseline.listeners && activity.timers <= baseline.timers, `cycle ${cycle + 1} added a global effect`)
    if (steady) assert.deepEqual(activity, steady)
    else steady = activity
  }

  assert.equal(
    renderer.root.findByProps({ placeholder: 'Buscar cliente, pedido, produto ou tipo' }).props.value,
    'maria',
  )
  assert.match(nodeText(renderer.root), /Pedidos/)
  assert.equal(requests.filter((path) => path === '/api/orders').length >= 1, true)
})
