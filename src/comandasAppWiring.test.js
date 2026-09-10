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
  const typeOptions = renderer.root.findByProps({ 'aria-label': 'Tipo do pedido' })
  assert.equal(buttonNamed(typeOptions, 'Consumo no local').props['aria-pressed'], true)
  assert.equal(renderer.root.findByProps({ className: 'new-order-table-grid' }).findAllByType('button').find((button) => nodeText(button).includes('Varanda')).props['aria-pressed'], true)
  await act(async () => buttonNamed(renderer.root, 'Cancelar venda').props.onClick())
  assert.match(nodeText(tableList()), /Varanda.*Livre/)
  await act(async () => buttonNamed(desktop(), 'Dashboard').props.onClick())
  await act(async () => buttonNamed(renderer.root, 'Novo pedido').props.onClick())
  assert.equal(buttonNamed(renderer.root.findByProps({ 'aria-label': 'Tipo do pedido' }), 'Entrega').props['aria-pressed'], true)
  assert.equal(renderer.root.findAllByProps({ className: 'new-order-table-grid' }).length, 0)
})

test('an occupied comanda adds another order with that table already selected', async (t) => {
  const harness = await workspaceHarness(t)
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (path) => {
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
  const navigation = () => renderer.root.findByProps({ 'aria-label': 'Menu principal' })
  await act(async () => buttonNamed(navigation(), 'Comandas').props.onClick())
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Mesas ativas' }).findAllByType('button')[0].props.onClick())

  const addOrder = buttonNamed(renderer.root.findByProps({ 'aria-label': 'Detalhe da comanda' }), 'Adicionar pedido')
  assert.ok(addOrder, 'occupied command detail exposes its add-order action')
  await act(async () => addOrder.props.onClick())
  assert.equal(buttonNamed(renderer.root.findByProps({ 'aria-label': 'Tipo do pedido' }), 'Consumo no local').props['aria-pressed'], true)
  assert.equal(renderer.root.findByProps({ className: 'new-order-table-grid' }).findAllByType('button').find((button) => nodeText(button).includes('Mesa 7')).props['aria-pressed'], true)
})

test('a successful table checkout returns to Comandas with the authoritative occupied summary selected', async (t) => {
  const harness = await workspaceHarness(t)
  const requests = []
  const createdTables = workspaceTables.map((table) => table.id === 'free'
    ? { ...table, occupancy: 'occupied', openTableTab: { id: 'tab-99', number: 99, itemCount: 1, totalCents: 2000 } }
    : table)
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (path, options = {}) => {
    requests.push([path, options.method || 'GET'])
    const responses = {
      '/api/auth/session': { authenticated: true },
      '/api/bootstrap': { tables: workspaceTables, tableTabs: [], orders: [], clients: [], products: [], movements: [], financeSettings: null },
      '/api/printing/stations': { stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }] },
      '/api/printing/jobs?limit=100': { jobs: [] },
      '/api/orders': { order: { id: 'order-99', paymentStatus: 'Pendente', status: 'Em preparo' }, movement: null, tableTab: { id: 'tab-99', tableId: 'free', number: 99, status: 'open' }, tables: createdTables },
    }
    assert.ok(Object.hasOwn(responses, path), `Unexpected request: ${path}`)
    return { ok: true, json: async () => responses[path] }
  }
  t.after(() => { globalThis.fetch = originalFetch })
  const { default: App } = await harness.load('/src/App.jsx')
  const { NewOrderRoute } = await harness.load('/src/pages/NewOrderRoute.jsx')
  const renderer = await harness.render(App)
  const navigation = () => renderer.root.findByProps({ 'aria-label': 'Menu principal' })
  await act(async () => buttonNamed(navigation(), 'Comandas').props.onClick())
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Mesas ativas' }).findAllByType('button')[1].props.onClick())
  const route = renderer.root.findByType(NewOrderRoute)
  await act(async () => {
    assert.equal(await route.props.onSubmit({
      type: 'Local',
      orderDate: '2026-09-10',
      customerIdentity: { type: 'table', tableId: 'free' },
      items: [{ productId: 'product-1', quantity: 1, price: 20 }],
    }), true)
  })

  const tableList = renderer.root.findByProps({ 'aria-label': 'Mesas ativas' })
  const varanda = tableList.findAllByType('button').find((button) => nodeText(button).includes('Varanda'))
  assert.equal(varanda.props['aria-pressed'], true)
  assert.match(nodeText(tableList), /Varanda.*Comanda 99.*20,00/)
  assert.ok(requests.some(([path, method]) => path === '/api/orders' && method === 'POST'))
})
