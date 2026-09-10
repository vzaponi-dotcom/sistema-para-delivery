import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness, workspaceTables, nodeText, buttonNamed } from './test-support/renderWorkspace.js'
import { comandaDetail, deferred, detailResponse } from './test-support/comandaFixtures.js'

async function paymentWorkspace(t, mobile = false) {
  const h = await workspaceHarness(t, { mobile })
  const state = { tables: workspaceTables, expired: false, pending: [], detail: comandaDetail, bootstrapCalls: 0 }
  globalThis.fetch = async (path, options = {}) => {
    if (path.endsWith('/payment')) {
      const p = deferred(); state.pending.push({ ...p, path, options }); return p.promise
    }
    if (path.startsWith('/api/table-tabs/')) {
      if (state.deferDetail) return state.deferDetail.promise
      return detailResponse(state.details?.[path] || state.detail)
    }
    if (path === '/api/bootstrap') {
      state.bootstrapCalls++
      if (state.deferBootstrap) return state.deferBootstrap.promise
      if (state.expired) return { ok: false, status: 401, json: async () => ({ error: { message: 'Sessão expirada' } }) }
      return { ok: true, json: async () => ({ tables: state.tables, tableTabs: [], orders: [], movements: [], clients: [], products: [], financeSettings: null }) }
    }
    const responses = {
      '/api/auth/session': { authenticated: true }, '/api/auth/login': {},
      '/api/printing/stations': { stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }] },
      '/api/printing/jobs?limit=100': { jobs: [] },
    }
    assert.ok(Object.hasOwn(responses, path), path)
    return { ok: true, json: async () => responses[path] }
  }
  const { default: App } = await h.load('/src/App.jsx')
  const r = await h.render(App)
  const navigate = async (name) => act(async () => buttonNamed(r.root.findByProps({ 'aria-label': 'Menu principal' }), name).props.onClick())
  const select = async () => act(async () => r.root.findByProps({ 'aria-label': 'Mesas ativas' }).findAllByType('button')[0].props.onClick())
  const pay = async () => {
    const action = buttonNamed(r.root, 'Registrar pagamento')
    assert.ok(action, 'occupied detail must expose full payment')
    await act(async () => action.props.onClick())
    await act(async () => { void r.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
  }
  await navigate('Comandas'); await select()
  return { h, r, state, navigate, select, pay }
}

const paidResult = () => ({
  orders: [{ id: 'paid-order', client: 'Mesa 7', total: 123.45, paymentStatus: 'Pago', status: 'Finalizado', type: 'Local' }],
  movements: [{ id: 'paid-movement', description: 'Pagamento comanda', value: 123.45, type: 'entrada', date: '2026-09-10' }],
  tableTab: { id: 'tab-42', number: 42, tableId: 'occupied', tableIdentifier: 'Mesa 7', status: 'closed' },
  tables: workspaceTables.map((table) => table.id === 'occupied' ? { ...table, occupancy: 'free', openTableTab: null } : table),
})
const jsonResponse = (data) => ({ ok: true, json: async () => data })

for (const outcome of ['success', 'error']) test(`payment reconciliation ignores old bootstrap ${outcome} after business reset`, async (t) => {
  const { h, r, state, pay, navigate, select } = await paymentWorkspace(t)
  await pay()
  const oldRead = deferred()
  state.deferBootstrap = oldRead
  await act(async () => h.window.dispatchEvent(new Event('focus')))
  await act(async () => state.pending[0].resolve(jsonResponse(paidResult())))
  // The queued reconciliation belongs to the old session. A detail read can
  // expire that session while bootstrap is still waiting on the network.
  state.deferDetail = { promise: Promise.resolve({ ok: false, status: 401, json: async () => ({ error: { message: 'Sessão expirada' } }) }) }
  await navigate('Clientes'); await navigate('Comandas')
  state.deferBootstrap = null; state.deferDetail = null
  await act(async () => r.root.findByProps({ placeholder: 'Digite o PIN' }).props.onChange({ target: { value: '1234' } }))
  await act(async () => r.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  await navigate('Comandas'); await select(); await pay()
  await act(async () => h.window.dispatchEvent(new Event('focus')))
  await act(async () => oldRead.resolve(outcome === 'success'
    ? jsonResponse({ tables: paidResult().tables, orders: paidResult().orders, movements: paidResult().movements, tableTabs: [paidResult().tableTab], clients: [], products: [] })
    : { ok: false, status: 401, json: async () => ({ error: { message: 'Sessão antiga' } }) }))
  assert.ok(buttonNamed(r.root, 'Confirmar pagamento')?.props.disabled, 'old reconciliation cannot clear the new session or its payment')
  assert.match(nodeText(r.root.findByProps({ 'aria-label': 'Mesas ativas' })), /Ocupada/)
  await act(async () => state.pending[1].reject(new Error('Pagamento não concluído')))
})

for (const mobile of [false, true]) test(`official full payment releases table and synchronizes all consumers (${mobile})`, async (t) => {
  const { h, r, state, pay, navigate } = await paymentWorkspace(t, mobile)
  await pay()
  assert.equal(state.pending.length, 1)
  assert.equal(state.pending[0].path, '/api/table-tabs/tab-42/payment')
  assert.deepEqual(JSON.parse(state.pending[0].options.body), { method: 'Pix' })
  assert.match(nodeText(r.root.findByProps({ 'aria-label': 'Mesas ativas' })), /Ocupada/)
  await act(async () => state.pending[0].resolve(jsonResponse(paidResult())))
  assert.equal(r.root.findAllByProps({ role: 'dialog' }).length, 0)
  assert.match(nodeText(r.root.findByProps({ 'aria-label': 'Mesas ativas' })), /Mesa 7Livre/)
  assert.match(nodeText(r.root.findByProps({ 'aria-label': 'Detalhe da comanda' })), /Selecione/)
  const { default: Comandas } = await h.load('/src/pages/Comandas.jsx')
  assert.equal(r.root.findByType(Comandas).props.selectedTableId, null)
  assert.ok(!r.root.findByProps({ className: 'comandas-page' }).props.className.includes('has-mobile-detail'))
  await navigate('A Receber')
  const { default: Receivables } = await h.load('/src/pages/Receivables.jsx')
  assert.deepEqual(r.root.findByType(Receivables).props.orders, paidResult().orders)
  assert.deepEqual(r.root.findByType(Receivables).props.movements, paidResult().movements)
  await navigate('Comandas')
  await act(async () => r.root.findByProps({ 'aria-label': 'Mesas ativas' }).findAllByType('button')[0].props.onClick())
  const { NewOrderRoute } = await h.load('/src/pages/NewOrderRoute.jsx')
  assert.deepEqual(r.root.findByType(NewOrderRoute).props.tableTabs, [paidResult().tableTab])
})

test('payment conflict refreshes official tables and removes the mobile closed selection', async (t) => {
  const { h, r, state, pay } = await paymentWorkspace(t, true)
  await pay()
  state.tables = paidResult().tables
  const reads = state.bootstrapCalls
  await act(async () => state.pending[0].resolve({ ok: false, status: 409, json: async () => ({ error: { message: 'Comanda já encerrada.' } }) }))
  assert.ok(state.bootstrapCalls > reads)
  assert.match(nodeText(r.root), /Comanda já encerrada/)
  assert.match(nodeText(r.root.findByProps({ 'aria-label': 'Mesas ativas' })), /Mesa 7Livre/)
  const { default: Comandas } = await h.load('/src/pages/Comandas.jsx')
  assert.equal(r.root.findByType(Comandas).findByType('div').props.className, 'comandas-page')
})

test('payment completion cannot replace newer official tables or clear a newer selected tab', async (t) => {
  const { h, r, state, pay, select } = await paymentWorkspace(t)
  await pay()
  state.tables = workspaceTables.map((table) => table.id === 'occupied' ? { ...table, openTableTab: { id: 'tab-99', number: 99, itemCount: 1, totalCents: 2000 } } : table)
  state.detail = { ...comandaDetail, id: 'tab-99', number: 99, totalCents: 2000 }
  await act(async () => h.window.dispatchEvent(new Event('focus')))
  await select()
  await act(async () => state.pending[0].resolve(jsonResponse(paidResult())))
  assert.match(nodeText(r.root.findByProps({ 'aria-label': 'Detalhe da comanda' })), /Comanda 99/)
  assert.match(nodeText(r.root.findByProps({ 'aria-label': 'Mesas ativas' })), /Comanda 99/)
  assert.ok(!buttonNamed(r.root, 'Registrar pagamento').props.disabled)
})

for (const outcome of ['success', 'error']) test(`old-session payment ${outcome} cannot mutate or unlock a newer session payment`, async (t) => {
  const { h, r, state, pay, navigate, select } = await paymentWorkspace(t)
  await pay()
  state.expired = true
  await act(async () => h.window.dispatchEvent(new Event('focus')))
  state.expired = false
  await act(async () => r.root.findByProps({ placeholder: 'Digite o PIN' }).props.onChange({ target: { value: '1234' } }))
  await act(async () => r.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  await navigate('Comandas'); await select(); await pay()
  await act(async () => state.pending[0].resolve(outcome === 'success' ? jsonResponse(paidResult()) : { ok: false, status: 401, json: async () => ({ error: { message: 'Erro antigo' } }) }))
  assert.ok(buttonNamed(r.root, 'Confirmar pagamento').props.disabled)
  assert.match(nodeText(r.root.findByProps({ 'aria-label': 'Mesas ativas' })), /Ocupada/)
  assert.doesNotMatch(nodeText(r.root), /Erro antigo|Pagamento de/)
  await navigate('A Receber')
  const { default: Receivables } = await h.load('/src/pages/Receivables.jsx')
  assert.deepEqual(r.root.findByType(Receivables).props.orders, [])
  assert.deepEqual(r.root.findByType(Receivables).props.movements, [])
  await navigate('Comandas')
  await act(async () => state.pending[1].resolve(jsonResponse(paidResult())))
  assert.match(nodeText(r.root.findByProps({ 'aria-label': 'Mesas ativas' })), /Mesa 7Livre/)
})

test('payment settling after selection of another table keeps that detail and applies official effects', async (t) => {
  const { h, r, state, pay, navigate } = await paymentWorkspace(t)
  const other = { id: 'other', name: 'Terraço', isActive: true, occupancy: 'occupied', sortOrder: 3, openTableTab: { id: 'tab-43', number: 43, itemCount: 3, totalCents: 12345 } }
  state.tables = [...workspaceTables, other]
  state.details = { '/api/table-tabs/tab-43': { ...comandaDetail, id: 'tab-43', number: 43, table: { id: 'other', name: 'Terraço' } } }
  await act(async () => h.window.dispatchEvent(new Event('focus')))
  await pay()
  await act(async () => r.root.findByProps({ 'aria-label': 'Mesas ativas' }).findAllByType('button').at(-1).props.onClick())
  assert.equal(r.root.findAllByProps({ role: 'dialog' }).length, 0)
  await act(async () => state.pending[0].resolve(jsonResponse({ ...paidResult(), tables: [...paidResult().tables, other] })))
  assert.match(nodeText(r.root.findByProps({ 'aria-label': 'Detalhe da comanda' })), /Comanda 43.*Terraço/)
  assert.match(nodeText(r.root.findByProps({ 'aria-label': 'Mesas ativas' })), /Mesa 7Livre/)
  await navigate('A Receber')
  const { default: Receivables } = await h.load('/src/pages/Receivables.jsx')
  assert.deepEqual(r.root.findByType(Receivables).props.orders, paidResult().orders)
})

for (const outcome of ['success', 'error']) test(`old detail ${outcome} cannot reach a relogged business using the same table identifiers`, async (t) => {
  const { h, r, state, navigate, select } = await paymentWorkspace(t)
  const oldDetail = deferred()
  state.deferDetail = oldDetail
  await act(async () => h.window.dispatchEvent(new Event('focus')))
  state.expired = true
  await act(async () => h.window.dispatchEvent(new Event('focus')))
  state.expired = false
  state.deferDetail = null
  state.detail = { ...comandaDetail, businessName: 'Outro negócio', items: [{ ...comandaDetail.items[0], note: 'Nova consulta' }] }
  await act(async () => r.root.findByProps({ placeholder: 'Digite o PIN' }).props.onChange({ target: { value: '1234' } }))
  await act(async () => r.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  await navigate('Comandas'); await select()
  await act(async () => oldDetail.resolve(outcome === 'success' ? detailResponse() : { ok: false, status: 401, json: async () => ({ error: { message: 'Sessão antiga' } }) }))
  assert.match(nodeText(r.root.findByProps({ 'aria-label': 'Detalhe da comanda' })), /Nova consulta/)
  assert.doesNotMatch(nodeText(r.root), /Sem cebola|Sessão antiga/)
  assert.ok(!buttonNamed(r.root, 'Registrar pagamento').props.disabled)
})

test('payment failure retains the full dialog for retry and going offline blocks confirmation', async (t) => {
  const { h, r, state, pay } = await paymentWorkspace(t)
  await pay()
  await act(async () => state.pending[0].reject(new Error('Conexão interrompida')))
  assert.match(nodeText(r.root), /Conexão interrompida/)
  assert.ok(!buttonNamed(r.root, 'Confirmar pagamento').props.disabled)
  await act(async () => h.window.dispatchEvent(new Event('offline')))
  await act(async () => r.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.equal(state.pending.length, 1)
  assert.ok(buttonNamed(r.root, 'Confirmar pagamento').props.disabled)
  await act(async () => h.window.dispatchEvent(new Event('online')))
  await act(async () => { void r.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
  assert.equal(state.pending.length, 2)
  await act(async () => state.pending[1].resolve(jsonResponse(paidResult())))
  assert.match(nodeText(r.root.findByProps({ 'aria-label': 'Mesas ativas' })), /Mesa 7Livre/)
})

const lifecycleProduct = { id: 'product-1', name: 'Coxinha', category: 'Lanches', presentationType: 'unit', price: 20, isActive: true }
const checkoutDetails = {
  '/api/table-tabs/tab-42': { tableTab: comandaDetail },
  ...Object.fromEntries([['tab-99', 99], ['tab-100', 100], ['new-tab-200', 200], ['new-tab-201', 201]].map(([id, number]) => [
    `/api/table-tabs/${id}`, { tableTab: { ...comandaDetail, id, number, table: { id: 'free', name: 'Varanda' }, orderCount: 1, itemCount: 1, totalCents: 2000 } },
  ])),
}

const buttonContaining = (root, text) => root.findAllByType('button').find((button) => nodeText(button).includes(text))
const ids = (records = []) => records.map((record) => record.id)

async function prepareLocalOrderForCheckout(renderer) {
  await act(async () => buttonContaining(renderer.root, 'Continuar').props.onClick())
  const search = renderer.root.findAllByType('input').find((input) => input.props.placeholder === 'Nome, categoria ou apresentação')
  await act(async () => search.props.onChange({ target: { value: lifecycleProduct.name } }))
  await act(async () => renderer.root.findByProps({ 'aria-label': `Adicionar ${lifecycleProduct.name}` }).props.onClick())
  await act(async () => buttonNamed(renderer.root, 'Revisar pedido').props.onClick())
}

test('App renders official Comandas, preserves selection across destinations and blocks offline launches', async (t) => {
  const harness = await workspaceHarness(t)
  const requests = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (path, options) => {
    requests.push([path, options.method || 'GET'])
    const responses = {
      ...checkoutDetails,
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
  const newOrder = renderer.root.findAllByProps({ 'aria-label': 'Novo pedido' })[0]
  assert.ok(newOrder, nodeText(renderer.root))
  await act(async () => newOrder.props.onClick())
  assert.equal(buttonNamed(renderer.root.findByProps({ 'aria-label': 'Tipo do pedido' }), 'Entrega').props['aria-pressed'], true)
  assert.equal(renderer.root.findAllByProps({ className: 'new-order-table-grid' }).length, 0)
})

test('an occupied comanda adds another order through the preselected wizard and returns to its summary', async (t) => {
  const harness = await workspaceHarness(t)
  const requests = []
  const afterCheckoutTables = workspaceTables.map((table) => table.id === 'occupied'
    ? { ...table, openTableTab: { ...table.openTableTab, itemCount: 4, totalCents: 14345 } }
    : table)
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (path, options = {}) => {
    requests.push([path, options])
    if (path === '/api/table-tabs/tab-42') return detailResponse(requests.some(([url]) => url === '/api/orders')
      ? { ...comandaDetail, itemCount: 4, totalCents: 14345, items: [...comandaDetail.items, { productId: 'product-1', name: 'Coxinha', presentation: '', note: '', quantity: 1, unitPriceCents: 2000, lineTotalCents: 2000 }] }
      : comandaDetail)
    const responses = {
      ...checkoutDetails,
      '/api/auth/session': { authenticated: true },
      '/api/bootstrap': { tables: workspaceTables, tableTabs: [], orders: [], clients: [], products: [lifecycleProduct], movements: [], financeSettings: null },
      '/api/printing/stations': { stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }] },
      '/api/printing/jobs?limit=100': { jobs: [] },
      '/api/orders': { order: { id: 'order-43', paymentStatus: 'Pendente', status: 'Em preparo' }, movement: null, tableTab: { id: 'tab-42', tableId: 'occupied', number: 42, status: 'open' }, tables: afterCheckoutTables },
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
  await prepareLocalOrderForCheckout(renderer)
  await act(async () => buttonNamed(renderer.root, 'Salvar pedido').props.onClick())
  assert.match(nodeText(renderer.root.findByProps({ 'aria-label': 'Detalhe da comanda' })), /Comanda 42.*4 itens.*143,45/)
  assert.match(nodeText(renderer.root.findByProps({ 'aria-label': 'Detalhe da comanda' })), /1x Coxinha/)
  assert.equal(requests.filter(([path]) => path === '/api/table-tabs/tab-42').length, 2)
  const orderRequest = requests.find(([path, options]) => path === '/api/orders' && options.method === 'POST')
  const orderPayload = JSON.parse(orderRequest[1].body)
  assert.equal(orderPayload.type, 'Local')
  assert.deepEqual(orderPayload.customerIdentity, { type: 'table', tableId: 'occupied' })
  assert.equal(orderPayload.items[0].productId, lifecycleProduct.id)
  assert.match(orderRequest[1].headers['idempotency-key'], /.+/)
})

test('an occupied comanda can cancel its preselected wizard without creating an order', async (t) => {
  const harness = await workspaceHarness(t)
  const requests = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (path, options = {}) => {
    requests.push([path, options])
    const responses = {
      ...checkoutDetails,
      '/api/auth/session': { authenticated: true },
      '/api/bootstrap': { tables: workspaceTables, tableTabs: [], orders: [], clients: [], products: [lifecycleProduct], movements: [], financeSettings: null },
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
  await act(async () => buttonNamed(renderer.root.findByProps({ 'aria-label': 'Detalhe da comanda' }), 'Adicionar pedido').props.onClick())
  assert.equal(buttonNamed(renderer.root.findByProps({ 'aria-label': 'Tipo do pedido' }), 'Consumo no local').props['aria-pressed'], true)
  await act(async () => buttonNamed(renderer.root, 'Cancelar venda').props.onClick())
  assert.match(nodeText(renderer.root.findByProps({ 'aria-label': 'Detalhe da comanda' })), /Comanda 42.*3 itens.*123,45/)
  assert.equal(requests.filter(([path, options]) => path === '/api/orders' && options.method === 'POST').length, 0)
})

test('a successful table checkout returns to Comandas with the authoritative occupied summary selected', async (t) => {
  const harness = await workspaceHarness(t)
  const requests = []
  const createdTables = workspaceTables.map((table) => table.id === 'free'
    ? { ...table, occupancy: 'occupied', openTableTab: { id: 'tab-99', number: 99, itemCount: 1, totalCents: 2000 } }
    : table)
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (path, options = {}) => {
    requests.push([path, options])
    const responses = {
      ...checkoutDetails,
      '/api/auth/session': { authenticated: true },
      '/api/bootstrap': { tables: workspaceTables, tableTabs: [], orders: [], clients: [], products: [lifecycleProduct], movements: [], financeSettings: null },
      '/api/printing/stations': { stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }] },
      '/api/printing/jobs?limit=100': { jobs: [] },
      '/api/orders': { order: { id: 'order-99', paymentStatus: 'Pendente', status: 'Em preparo' }, movement: null, tableTab: { id: 'tab-99', tableId: 'free', number: 99, status: 'open' }, tables: createdTables },
    }
    assert.ok(Object.hasOwn(responses, path), `Unexpected request: ${path}`)
    return { ok: true, json: async () => responses[path] }
  }
  t.after(() => { globalThis.fetch = originalFetch })
  const { default: App } = await harness.load('/src/App.jsx')
  const renderer = await harness.render(App)
  const navigation = () => renderer.root.findByProps({ 'aria-label': 'Menu principal' })
  await act(async () => buttonNamed(navigation(), 'Comandas').props.onClick())
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Mesas ativas' }).findAllByType('button')[1].props.onClick())
  await prepareLocalOrderForCheckout(renderer)
  await act(async () => buttonNamed(renderer.root, 'Salvar pedido').props.onClick())

  const tableList = renderer.root.findByProps({ 'aria-label': 'Mesas ativas' })
  const varanda = tableList.findAllByType('button').find((button) => nodeText(button).includes('Varanda'))
  assert.equal(varanda.props['aria-pressed'], true)
  assert.match(nodeText(tableList), /Varanda.*Comanda 99.*20,00/)
  const orderRequest = requests.find(([path, options]) => path === '/api/orders' && options.method === 'POST')
  assert.deepEqual(JSON.parse(orderRequest[1].body).customerIdentity, { type: 'table', tableId: 'free' })
  assert.equal(JSON.parse(orderRequest[1].body).items[0].productId, lifecycleProduct.id)
})

test('an unavailable table rejection retains the real wizard draft and retries with its idempotency key', async (t) => {
  const harness = await workspaceHarness(t)
  let tableUnavailable = false
  const orderRequests = []
  const retryTables = workspaceTables.map((table) => table.id === 'free'
    ? { ...table, occupancy: 'occupied', openTableTab: { id: 'tab-100', number: 100, itemCount: 1, totalCents: 2000 } }
    : table)
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (path, options = {}) => {
    if (path === '/api/orders' && options.method === 'POST') {
      orderRequests.push(options)
      if (orderRequests.length === 1) return { ok: false, status: 409, json: async () => ({ error: { message: 'A mesa não está disponível.' } }) }
      return { ok: true, json: async () => ({ order: { id: 'order-100', paymentStatus: 'Pendente', status: 'Em preparo' }, movement: null, tableTab: { id: 'tab-100', tableId: 'free', number: 100, status: 'open' }, tables: retryTables }) }
    }
    const bootstrapTables = tableUnavailable ? workspaceTables.map((table) => table.id === 'free' ? { ...table, isActive: false } : table) : workspaceTables
    const responses = {
      ...checkoutDetails,
      '/api/auth/session': { authenticated: true },
      '/api/bootstrap': { tables: bootstrapTables, tableTabs: [], orders: [], clients: [], products: [lifecycleProduct], movements: [], financeSettings: null },
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
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Mesas ativas' }).findAllByType('button')[1].props.onClick())
  await prepareLocalOrderForCheckout(renderer)
  tableUnavailable = true
  await act(async () => harness.window.dispatchEvent(new Event('focus')))
  await act(async () => buttonNamed(renderer.root, 'Salvar pedido').props.onClick())
  assert.match(nodeText(renderer.root), /A mesa não está disponível/)
  assert.match(nodeText(renderer.root), /Coxinha/)

  tableUnavailable = false
  await act(async () => buttonNamed(renderer.root, 'Salvar pedido').props.onClick())
  assert.equal(orderRequests.length, 2)
  assert.equal(orderRequests[0].headers['idempotency-key'], orderRequests[1].headers['idempotency-key'])
  assert.match(nodeText(renderer.root.findByProps({ 'aria-label': 'Mesas ativas' })), /Varanda.*Comanda 100/)
})

test('a deferred old checkout cannot mutate or leave an ownerless wizard after reset and relogin', async (t) => {
  const harness = await workspaceHarness(t)
  const { NewOrderRoute } = await harness.load('/src/pages/NewOrderRoute.jsx')
  const { default: Comandas } = await harness.load('/src/pages/Comandas.jsx')
  const { default: Receivables } = await harness.load('/src/pages/Receivables.jsx')
  let sessionExpired = false
  const orderResolvers = []
  const orderStarted = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (path, options = {}) => {
    if (path === '/api/bootstrap' && sessionExpired) {
      return { ok: false, status: 401, json: async () => ({ error: { message: 'Sessão expirada.' } }) }
    }
    if (path === '/api/orders' && options.method === 'POST') {
      return new Promise((resolve) => {
        orderResolvers.push(resolve)
        orderStarted.shift()?.()
      })
    }
    const responses = {
      ...checkoutDetails,
      '/api/auth/session': { authenticated: true },
      '/api/auth/login': {},
      '/api/bootstrap': { tables: workspaceTables, tableTabs: [], orders: [], clients: [], products: [lifecycleProduct], movements: [], financeSettings: null },
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
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Mesas ativas' }).findAllByType('button')[1].props.onClick())
  await prepareLocalOrderForCheckout(renderer)
  const firstOrderStarted = new Promise((resolve) => orderStarted.push(resolve))
  await act(async () => {
    void buttonNamed(renderer.root, 'Salvar pedido').props.onClick()
    await firstOrderStarted
  })

  sessionExpired = true
  await act(async () => harness.window.dispatchEvent(new Event('focus')))
  assert.equal(renderer.root.findAllByType('form').length, 1)
  sessionExpired = false
  const loginInput = renderer.root.findByProps({ placeholder: 'Digite o PIN' })
  await act(async () => loginInput.props.onChange({ target: { value: '1234' } }))
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Tipo do pedido' }).length, 0, 'relogin exits the ownerless wizard')
  assert.ok(renderer.root.findAllByProps({ 'aria-label': 'Novo pedido' }).length, 'relogin returns to the authenticated landing')
  await act(async () => buttonNamed(navigation(), 'Comandas').props.onClick())
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Mesas ativas' }).findAllByType('button')[1].props.onClick())
  await prepareLocalOrderForCheckout(renderer)
  const secondOrderStarted = new Promise((resolve) => orderStarted.push(resolve))
  await act(async () => {
    void buttonNamed(renderer.root, 'Salvar pedido').props.onClick()
    await secondOrderStarted
  })

  const replacementRoute = renderer.root.findByType(NewOrderRoute)
  assert.deepEqual(ids(replacementRoute.props.tables), ids(workspaceTables), 'replacement route still receives only the relogged bootstrap tables')
  assert.deepEqual(ids(replacementRoute.props.tableTabs), [], 'replacement route receives no old-session tab')
  assert.deepEqual(ids(replacementRoute.props.products), [lifecycleProduct.id])
  assert.doesNotMatch(JSON.stringify(replacementRoute.props), /stale-(order|movement|tab|table)|Mesa Stale Exclusiva/)

  await act(async () => {
    orderResolvers[0]({ ok: true, json: async () => ({ order: { id: 'stale-order-9999', client: 'Cliente Stale Exclusivo', type: 'Local', total: 7777, paymentStatus: 'Pendente', status: 'Em preparo' }, movement: { id: 'stale-movement-9999', description: 'Movimento Stale Exclusivo', type: 'entrada', value: 7777, category: 'Vendas', date: '2026-09-10' }, tableTab: { id: 'stale-tab-501', tableId: 'stale-table-501', number: 501 }, tables: [{ id: 'stale-table-501', name: 'Mesa Stale Exclusiva', isActive: true, occupancy: 'occupied', sortOrder: 1, openTableTab: { id: 'stale-tab-501', number: 501, itemCount: 1, totalCents: 7777 } }] }) })
    await Promise.resolve()
  })
  assert.equal(renderer.root.findAllByType(NewOrderRoute).length, 1, 'stale success cannot replace the newer wizard')
  assert.equal(buttonNamed(renderer.root, 'Salvar pedido').props.disabled, true, 'old finally cannot clear the newer checkout loading state')
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Mesas ativas' }).length, 0)
  const stillOwnedRoute = renderer.root.findByType(NewOrderRoute)
  assert.deepEqual(ids(stillOwnedRoute.props.tables), ids(workspaceTables), 'stale tables never reach the replacement route')
  assert.deepEqual(ids(stillOwnedRoute.props.tableTabs), [], 'stale table tab never reaches the replacement route')
  assert.doesNotMatch(JSON.stringify(stillOwnedRoute.props), /stale-(order|movement|tab|table)|Mesa Stale Exclusiva/)
  assert.doesNotMatch(nodeText(renderer.root), /Mesa Stale Exclusiva|Cliente Stale Exclusivo|Movimento Stale Exclusivo|Pedido entrou em preparo/)
  await act(async () => {
    orderResolvers[1]({ ok: true, json: async () => ({ order: { id: 'new-order-200', client: 'Cliente Novo 200', type: 'Local', total: 2000, paymentStatus: 'Pendente', status: 'Em preparo' }, movement: { id: 'new-movement-200', description: 'Movimento Novo 200', type: 'entrada', value: 2000, category: 'Vendas', date: '2026-09-10' }, tableTab: { id: 'new-tab-200', tableId: 'free', number: 200, status: 'open' }, tables: workspaceTables.map((table) => table.id === 'free' ? { ...table, occupancy: 'occupied', openTableTab: { id: 'new-tab-200', number: 200, itemCount: 1, totalCents: 2000 } } : table) }) })
    await Promise.resolve()
  })
  assert.match(nodeText(renderer.root.findByProps({ 'aria-label': 'Detalhe da comanda' })), /Comanda 200.*20,00/)
  const comandas = renderer.root.findByType(Comandas)
  assert.equal(comandas.props.selectedTableId, 'free')
  assert.deepEqual(ids(comandas.props.tables), ids(workspaceTables), 'Comandas consumes only the newer returned tables')
  assert.doesNotMatch(JSON.stringify(comandas.props), /stale-(order|movement|tab|table)|Mesa Stale Exclusiva/)
  await act(async () => buttonNamed(navigation(), 'A Receber').props.onClick())
  const receivables = renderer.root.findByType(Receivables)
  assert.deepEqual(ids(receivables.props.orders), ['new-order-200'], 'A Receber receives the newer order, not the stale order')
  assert.deepEqual(ids(receivables.props.movements), ['new-movement-200'], 'A Receber receives the newer movement, not the stale movement')
  await act(async () => buttonNamed(navigation(), 'Comandas').props.onClick())
  await act(async () => buttonNamed(renderer.root.findByProps({ 'aria-label': 'Detalhe da comanda' }), 'Adicionar pedido').props.onClick())
  const postCheckoutRoute = renderer.root.findByType(NewOrderRoute)
  assert.deepEqual(ids(postCheckoutRoute.props.tableTabs), ['new-tab-200'], 'a normal new-order route consumes only the newer table tab')
  assert.doesNotMatch(JSON.stringify(postCheckoutRoute.props), /stale-(order|movement|tab|table)|Mesa Stale Exclusiva/)
})

test('a deferred stale checkout rejection cannot clear or report over a newer relogged checkout', async (t) => {
  const harness = await workspaceHarness(t)
  const { NewOrderRoute } = await harness.load('/src/pages/NewOrderRoute.jsx')
  const { default: Receivables } = await harness.load('/src/pages/Receivables.jsx')
  let sessionExpired = false
  const orderResolvers = []
  const orderStarted = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (path, options = {}) => {
    if (path === '/api/bootstrap' && sessionExpired) {
      return { ok: false, status: 401, json: async () => ({ error: { message: 'Sessão expirada.' } }) }
    }
    if (path === '/api/orders' && options.method === 'POST') {
      return new Promise((resolve) => {
        orderResolvers.push(resolve)
        orderStarted.shift()?.()
      })
    }
    const responses = {
      ...checkoutDetails,
      '/api/auth/session': { authenticated: true },
      '/api/auth/login': {},
      '/api/bootstrap': { tables: workspaceTables, tableTabs: [], orders: [], clients: [], products: [lifecycleProduct], movements: [], financeSettings: null },
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
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Mesas ativas' }).findAllByType('button')[1].props.onClick())
  await prepareLocalOrderForCheckout(renderer)
  const oldOrderStarted = new Promise((resolve) => orderStarted.push(resolve))
  await act(async () => {
    void buttonNamed(renderer.root, 'Salvar pedido').props.onClick()
    await oldOrderStarted
  })
  sessionExpired = true
  await act(async () => harness.window.dispatchEvent(new Event('focus')))
  sessionExpired = false
  const loginInput = renderer.root.findByProps({ placeholder: 'Digite o PIN' })
  await act(async () => loginInput.props.onChange({ target: { value: '1234' } }))
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Tipo do pedido' }).length, 0)
  await act(async () => buttonNamed(navigation(), 'Comandas').props.onClick())
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Mesas ativas' }).findAllByType('button')[1].props.onClick())
  await prepareLocalOrderForCheckout(renderer)
  const newerOrderStarted = new Promise((resolve) => orderStarted.push(resolve))
  await act(async () => {
    void buttonNamed(renderer.root, 'Salvar pedido').props.onClick()
    await newerOrderStarted
  })
  const replacementRoute = renderer.root.findByType(NewOrderRoute)
  assert.deepEqual(ids(replacementRoute.props.tables), ids(workspaceTables))
  assert.deepEqual(ids(replacementRoute.props.tableTabs), [])

  await act(async () => {
    orderResolvers[0]({ ok: false, status: 500, json: async () => ({ error: { message: 'Falha antiga.' } }) })
    await Promise.resolve()
  })
  assert.equal(buttonNamed(renderer.root, 'Salvar pedido').props.disabled, true, 'stale finally cannot clear the newer checkout loading state')
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Mesas ativas' }).length, 0)
  const stillOwnedRoute = renderer.root.findByType(NewOrderRoute)
  assert.deepEqual(ids(stillOwnedRoute.props.tables), ids(workspaceTables), 'stale rejection leaves bootstrap tables intact')
  assert.deepEqual(ids(stillOwnedRoute.props.tableTabs), [], 'stale rejection leaves bootstrap tabs intact')
  assert.doesNotMatch(nodeText(renderer.root), /Falha antiga|Mesa Stale Exclusiva|Pedido entrou em preparo/)
  await act(async () => {
    orderResolvers[1]({ ok: true, json: async () => ({ order: { id: 'new-order-201', client: 'Cliente Novo 201', type: 'Local', total: 2000, paymentStatus: 'Pendente', status: 'Em preparo' }, movement: { id: 'new-movement-201', description: 'Movimento Novo 201', type: 'entrada', value: 2000, category: 'Vendas', date: '2026-09-10' }, tableTab: { id: 'new-tab-201', tableId: 'free', number: 201, status: 'open' }, tables: workspaceTables.map((table) => table.id === 'free' ? { ...table, occupancy: 'occupied', openTableTab: { id: 'new-tab-201', number: 201, itemCount: 1, totalCents: 2000 } } : table) }) })
    await Promise.resolve()
  })
  assert.match(nodeText(renderer.root.findByProps({ 'aria-label': 'Detalhe da comanda' })), /Comanda 201.*20,00/)
  await act(async () => buttonNamed(navigation(), 'A Receber').props.onClick())
  const receivables = renderer.root.findByType(Receivables)
  assert.deepEqual(ids(receivables.props.orders), ['new-order-201'])
  assert.deepEqual(ids(receivables.props.movements), ['new-movement-201'])
})
