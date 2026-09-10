import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness, buttonNamed, nodeText } from './test-support/renderWorkspace.js'

test('app keeps the dirty-order confirmation when navigating away from the wizard', async (t) => {
  const harness = await workspaceHarness(t)
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (path) => {
    const responses = {
      '/api/auth/session': { authenticated: true },
      '/api/bootstrap': { tables: [], tableTabs: [], orders: [], clients: [], products: [], movements: [], financeSettings: null },
      '/api/printing/stations': { stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }] },
      '/api/printing/jobs?limit=100': { jobs: [] },
    }
    assert.ok(Object.hasOwn(responses, path), `Unexpected request: ${path}`)
    return { ok: true, json: async () => responses[path] }
  }
  t.after(() => { globalThis.fetch = originalFetch })
  const { default: App } = await harness.load('/src/App.jsx')
  const renderer = await harness.render(App)
  const navigation = () => renderer.root.findByProps({ 'aria-label': 'Menu principal' })

  await act(async () => buttonNamed(renderer.root, 'Novo pedido').props.onClick())
  await act(async () => buttonNamed(renderer.root.findByProps({ 'aria-label': 'Tipo do pedido' }), 'Retirada').props.onClick())
  await act(async () => buttonNamed(navigation(), 'Comandas').props.onClick())

  assert.equal(nodeText(renderer.root).includes('Descartar venda em andamento?'), true)
  await act(async () => buttonNamed(renderer.root, 'Continuar na venda').props.onClick())
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Tipo do pedido' }).length, 1)
})
