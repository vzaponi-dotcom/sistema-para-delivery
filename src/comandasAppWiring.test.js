import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness, workspaceTables, nodeText, buttonNamed } from './test-support/renderWorkspace.js'

const lifecycleProduct = { id: 'product-1', name: 'Coxinha', category: 'Lanches', presentationType: 'unit', price: 20, isActive: true }

const buttonContaining = (root, text) => root.findAllByType('button').find((button) => nodeText(button).includes(text))

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
    const responses = {
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

  await act(async () => {
    orderResolvers[0]({ ok: true, json: async () => ({ order: { id: 'stale-order', paymentStatus: 'Pendente', status: 'Em preparo' }, movement: { id: 'stale-movement' }, tableTab: { id: 'stale-tab', tableId: 'stale', number: 501 }, tables: [{ id: 'stale', name: 'Mesa Stale', isActive: true, occupancy: 'occupied', sortOrder: 1, openTableTab: { id: 'stale-tab', number: 501, itemCount: 1, totalCents: 2000 } }] }) })
    await Promise.resolve()
  })
  assert.equal(buttonNamed(renderer.root, 'Salvar pedido').props.disabled, true, 'old finally cannot clear the newer checkout loading state')
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Mesas ativas' }).length, 0)
  assert.doesNotMatch(nodeText(renderer.root), /Mesa Stale|Pedido entrou em preparo/)
  await act(async () => {
    orderResolvers[1]({ ok: true, json: async () => ({ order: { id: 'order-200', paymentStatus: 'Pendente', status: 'Em preparo' }, movement: { id: 'movement-200' }, tableTab: { id: 'tab-200', tableId: 'free', number: 200, status: 'open' }, tables: workspaceTables.map((table) => table.id === 'free' ? { ...table, occupancy: 'occupied', openTableTab: { id: 'tab-200', number: 200, itemCount: 1, totalCents: 2000 } } : table) }) })
    await Promise.resolve()
  })
  assert.match(nodeText(renderer.root.findByProps({ 'aria-label': 'Detalhe da comanda' })), /Comanda 200.*20,00/)
  assert.doesNotMatch(nodeText(renderer.root), /Mesa Stale/)
})

test('a deferred stale checkout rejection cannot clear or report over a newer relogged checkout', async (t) => {
  const harness = await workspaceHarness(t)
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

  await act(async () => {
    orderResolvers[0]({ ok: false, status: 500, json: async () => ({ error: { message: 'Falha antiga.' } }) })
    await Promise.resolve()
  })
  assert.equal(buttonNamed(renderer.root, 'Salvar pedido').props.disabled, true, 'stale finally cannot clear the newer checkout loading state')
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Mesas ativas' }).length, 0)
  assert.doesNotMatch(nodeText(renderer.root), /Falha antiga|Mesa Stale|Pedido entrou em preparo/)
  await act(async () => {
    orderResolvers[1]({ ok: true, json: async () => ({ order: { id: 'order-201', paymentStatus: 'Pendente', status: 'Em preparo' }, movement: { id: 'movement-201' }, tableTab: { id: 'tab-201', tableId: 'free', number: 201, status: 'open' }, tables: workspaceTables.map((table) => table.id === 'free' ? { ...table, occupancy: 'occupied', openTableTab: { id: 'tab-201', number: 201, itemCount: 1, totalCents: 2000 } } : table) }) })
    await Promise.resolve()
  })
  assert.match(nodeText(renderer.root.findByProps({ 'aria-label': 'Detalhe da comanda' })), /Comanda 201.*20,00/)
})
