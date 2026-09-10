import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness, workspaceTables, nodeText, buttonNamed } from './test-support/renderWorkspace.js'

test('App renders official Comandas, preserves selection across destinations and blocks offline launches', async (t) => {
  const harness = await workspaceHarness(t)
  const requests = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (path, options) => {
    requests.push([path, options.method || 'GET'])
    const responses = {
      '/api/auth/session': { authenticated: true },
      '/api/bootstrap': { tables: workspaceTables, tableTabs: [], orders: [], clients: [], products: [], movements: [], financeSettings: null },
      '/api/printing/stations': { stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }] },
      '/api/printing/jobs?limit=100': { jobs: [] },
    }
    assert.ok(Object.hasOwn(responses, path), `Unexpected request: ${path}`)
    return { ok: true, json: async () => responses[path] }
  }
  t.after(() => { globalThis.fetch = originalFetch })
  const { default: App } = await harness.load('/src/App.jsx')
  const renderer = await harness.render(App)
  const desktop = () => renderer.root.findByProps({ 'aria-label': 'Menu principal' })
  assert.ok(buttonNamed(desktop(), 'Comandas'), 'App exposes its Comandas destination')
  await act(async () => buttonNamed(desktop(), 'Comandas').props.onClick())
  const tableList = () => renderer.root.findByProps({ 'aria-label': 'Mesas ativas' })
  assert.match(nodeText(tableList()), /Comanda 42.*123,45/)
  await act(async () => tableList().findAllByType('button')[0].props.onClick())
  assert.match(nodeText(renderer.root.findByProps({ 'aria-label': 'Detalhe da comanda' })), /Comanda 42/)
  await act(async () => buttonNamed(desktop(), 'Clientes').props.onClick())
  await act(async () => buttonNamed(desktop(), 'Comandas').props.onClick())
  assert.equal(tableList().findAllByType('button')[0].props['aria-pressed'], true)
  await act(async () => harness.window.dispatchEvent(new Event('offline')))
  assert.equal(tableList().findAllByType('button')[1].props.disabled, true)
  assert.ok(!tableList().findAllByType('button')[0].props.disabled)
  assert.ok(requests.every(([, method]) => method === 'GET'), 'consultation makes no mutations')
  await act(async () => harness.window.dispatchEvent(new Event('online')))
  await act(async () => tableList().findAllByType('button')[1].props.onClick())
  const { NewOrderRoute } = await harness.load('/src/pages/NewOrderRoute.jsx')
  assert.equal(renderer.root.findAllByType(NewOrderRoute).length, 1)
})
