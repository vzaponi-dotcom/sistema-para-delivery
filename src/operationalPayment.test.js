import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { buttonNamed, nodeText, workspaceHarness } from './test-support/renderWorkspace.js'

const flush = () => new Promise((resolve) => setImmediate(resolve))
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}
const response = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
})
const standaloneOrder = (id, overrides = {}) => ({
  id,
  orderNumber: id.replace(/\D/g, '') || '1',
  client: `Cliente ${id}`,
  customerIdentityType: 'registered_client',
  type: 'Entrega',
  status: 'Em preparo',
  paymentStatus: 'Pendente',
  orderDate: '2026-09-11',
  createdAt: '2026-09-11T12:00:00.000Z',
  subtotal: 40,
  total: 40,
  items: [{ id: `${id}-item`, productId: 'product-1', name: 'Marmita', quantity: 1, unitPrice: 40 }],
  ...overrides,
})
const paidEffects = (order, method = 'Pix') => ({
  order: { ...order, status: order.status, paymentStatus: 'Pago', paymentMethod: method, paidAmount: order.total },
  movement: { id: `movement-${order.id}`, description: `Pagamento ${order.id}`, type: 'entrada', value: order.total, category: 'Vendas', date: '2026-09-11', paymentMethod: method },
  tableTab: null,
})
const operationalCapabilities = new Set([
  'orders.view', 'orders.history', 'orders.analysis', 'orders.create', 'orders.finalize', 'orders.cancel',
  'payments.receive', 'clients.view', 'finance.receivables', 'finance.overview', 'finance.movements',
  'printing.queue', 'preferences.local',
])

async function operationalWorkspace(t, { orders, capabilities = operationalCapabilities } = {}) {
  const h = await workspaceHarness(t)
  const state = {
    orders: structuredClone(orders),
    bootstrapOrders: structuredClone(orders),
    bootstrapCalls: 0,
    paymentPosts: [],
    paymentHandler: null,
  }
  globalThis.fetch = async (path, options = {}) => {
    const url = String(path)
    const method = options.method || 'GET'
    if (url === '/api/auth/session') return response({ authenticated: true })
    if (url === '/api/auth/login' && method === 'POST') return response({})
    if (url === '/api/auth/logout' && method === 'POST') return response({})
    if (url === '/api/bootstrap') {
      state.bootstrapCalls += 1
      return response({ tables: [], tableTabs: [], orders: structuredClone(state.bootstrapOrders), movements: [], clients: [], products: [], financeSettings: null })
    }
    if (url === '/api/orders' && method === 'GET') return response({ orders: structuredClone(state.orders) })
    if (/^\/api\/orders\/[^/]+\/payment$/.test(url) && method === 'POST') {
      const pending = deferred()
      const request = { ...pending, url, options }
      state.paymentPosts.push(request)
      if (state.paymentHandler) return state.paymentHandler(request)
      return pending.promise
    }
    if (url === '/api/printing/stations') return response({ stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }] })
    if (url.startsWith('/api/printing/jobs?')) return response({ jobs: [] })
    throw new Error(`Unexpected request: ${url} ${method}`)
  }

  const { default: App } = await h.load('/src/App.jsx')
  const renderer = await h.render(App, { capabilities })
  const navigate = async (name) => act(async () => buttonNamed(renderer.root.findByProps({ 'aria-label': 'Menu principal' }), name).props.onClick())
  const openKitchenDetail = async () => act(async () => buttonNamed(renderer.root, 'Exibir detalhes').props.onClick())
  const openHistoryDetail = async () => act(async () => buttonNamed(renderer.root, 'Ver detalhes').props.onClick())
  const openOperationalPayment = async () => act(async () => buttonNamed(renderer.root, 'Registrar pagamento').props.onClick())
  const submitPayment = () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} })
  return { h, renderer, state, navigate, openKitchenDetail, openHistoryDetail, openOperationalPayment, submitPayment }
}

test('detalhe aberto usa o pedido oficial atual por ID e retira a ação quando ele é pago ou desaparece', async (t) => {
  const pending = standaloneOrder('101')
  const { h, renderer, state, openKitchenDetail } = await operationalWorkspace(t, { orders: [pending] })
  const { default: OrderDetail } = await h.load('/src/components/OrderDetail.jsx')

  await openKitchenDetail()
  assert.ok(buttonNamed(renderer.root, 'Registrar pagamento'))

  state.orders = [{ ...pending, client: 'Cliente atualizado', paymentStatus: 'Pago', paymentMethod: 'Pix' }]
  await act(async () => { h.fireInterval(2_000); await flush() })
  assert.match(nodeText(renderer.root.findByType(OrderDetail)), /Cliente atualizado/)
  assert.equal(buttonNamed(renderer.root, 'Registrar pagamento'), undefined)

  state.orders = []
  await act(async () => { h.fireInterval(2_000); await flush() })
  assert.equal(renderer.root.findAllByType(OrderDetail).length, 0)
})

test('Histórico recebe sem Financeiro, fecha detalhe e cancelar o modal preserva página e filtro', async (t) => {
  const order = standaloneOrder('202', { status: 'Finalizado', finishedAt: '2026-09-11T12:30:00.000Z' })
  const capabilities = new Set(['orders.history', 'payments.receive'])
  const { h, renderer, openHistoryDetail, openOperationalPayment } = await operationalWorkspace(t, { orders: [order], capabilities })
  const { default: OrderDetail } = await h.load('/src/components/OrderDetail.jsx')

  await act(async () => buttonNamed(renderer.root, 'Finalizados').props.onClick())
  await openHistoryDetail()
  assert.ok(buttonNamed(renderer.root, 'Registrar pagamento'))
  await openOperationalPayment()

  assert.equal(renderer.root.findAllByType(OrderDetail).length, 0)
  assert.match(nodeText(renderer.root), /Registrar pagamento.*Cliente 202/s)
  await act(async () => buttonNamed(renderer.root, 'Cancelar').props.onClick())
  assert.equal(buttonNamed(renderer.root, 'Finalizados').props['aria-pressed'], true)
  assert.equal(renderer.root.findAllByType(OrderDetail).length, 0)
  assert.equal(buttonNamed(renderer.root, 'Visão geral'), undefined)
})

test('cancelar pagamento na Cozinha não reabre detalhe e preserva a busca; offline desabilita a entrada', async (t) => {
  const { h, renderer, openKitchenDetail, openOperationalPayment } = await operationalWorkspace(t, { orders: [standaloneOrder('303', { client: 'Ana Souza' })] })
  const search = renderer.root.findByProps({ placeholder: 'Buscar cliente, pedido, produto ou tipo' })
  await act(async () => search.props.onChange({ target: { value: 'Ana' } }))
  await openKitchenDetail()
  await openOperationalPayment()
  await act(async () => buttonNamed(renderer.root, 'Cancelar').props.onClick())
  assert.equal(renderer.root.findByProps({ placeholder: 'Buscar cliente, pedido, produto ou tipo' }).props.value, 'Ana')
  assert.equal(buttonNamed(renderer.root, 'Registrar pagamento'), undefined)

  await openKitchenDetail()
  globalThis.navigator.onLine = false
  await act(async () => h.window.dispatchEvent(new Event('offline')))
  assert.equal(buttonNamed(renderer.root, 'Registrar pagamento').props.disabled, true)
})

test('clique duplo envia um POST e resposta válida após navegação aplica efeitos sem forçar retorno', async (t) => {
  const order = standaloneOrder('404')
  const { h, renderer, state, navigate, openKitchenDetail, openOperationalPayment, submitPayment } = await operationalWorkspace(t, { orders: [order] })
  const { default: Orders } = await h.load('/src/pages/Orders.jsx')

  await openKitchenDetail()
  await openOperationalPayment()
  let submission
  await act(async () => { submission = submitPayment(); void submitPayment(); await flush() })
  assert.equal(state.paymentPosts.length, 1)

  await navigate('Clientes')
  const paid = paidEffects(order)
  state.orders = [paid.order]
  await act(async () => { state.paymentPosts[0].resolve(response(paid)); await submission })
  assert.equal(buttonNamed(renderer.root.findByProps({ 'aria-label': 'Menu principal' }), 'Clientes').props['aria-current'], 'page')
  await navigate('Pedidos')
  assert.equal(renderer.root.findByType(Orders).props.orders.find((item) => item.id === order.id).paymentStatus, 'Pago')
})

test('resposta de A aplica efeitos oficiais mas não fecha nem altera método do novo alvo B', async (t) => {
  const orderA = standaloneOrder('501')
  const orderB = standaloneOrder('502', { status: 'Finalizado', finishedAt: '2026-09-11T13:00:00.000Z' })
  const { h, renderer, state, navigate, openKitchenDetail, openHistoryDetail, openOperationalPayment, submitPayment } = await operationalWorkspace(t, { orders: [orderA, orderB] })
  const { default: SystemSelect } = await h.load('/src/components/SystemSelect.jsx')

  await openKitchenDetail()
  await openOperationalPayment()
  let submissionA
  await act(async () => { submissionA = submitPayment(); await flush() })
  await act(async () => buttonNamed(renderer.root, 'Cancelar').props.onClick())

  await navigate('Pedidos')
  await act(async () => buttonNamed(renderer.root.findByProps({ 'aria-label': 'Navegação de Pedidos' }), 'Histórico').props.onClick())
  await openHistoryDetail()
  await openOperationalPayment()
  await act(async () => renderer.root.findByType(SystemSelect).props.onChange('Dinheiro'))
  let submissionB
  await act(async () => { submissionB = submitPayment(); await flush() })
  assert.equal(state.paymentPosts.length, 2)

  await act(async () => { state.paymentPosts[0].resolve(response(paidEffects(orderA, 'Pix'))); await submissionA })
  assert.match(nodeText(renderer.root), /Cliente 502/)
  assert.equal(renderer.root.findByType(SystemSelect).props.value, 'Dinheiro')
  assert.equal(buttonNamed(renderer.root, 'Confirmar pagamento').props.disabled, true)
  assert.doesNotMatch(nodeText(renderer.root), /Pagamento recebido via Pix/)

  await act(async () => { state.paymentPosts[1].resolve(response(paidEffects(orderB, 'Dinheiro'))); await submissionB })
})

test('resposta de pagamento da sessão antiga não altera nem desbloqueia o alvo da nova sessão', async (t) => {
  const orderA = standaloneOrder('601')
  const orderB = standaloneOrder('602')
  const { h, renderer, state, openKitchenDetail, openOperationalPayment, submitPayment } = await operationalWorkspace(t, { orders: [orderA] })
  const { default: Orders } = await h.load('/src/pages/Orders.jsx')

  await openKitchenDetail()
  await openOperationalPayment()
  let oldSubmission
  await act(async () => { oldSubmission = submitPayment(); await flush() })
  await act(async () => buttonNamed(renderer.root, 'Cancelar').props.onClick())
  state.orders = [orderB]
  state.bootstrapOrders = [orderB]
  await act(async () => buttonNamed(renderer.root, 'Sair do sistema').props.onClick())
  const pin = renderer.root.findByProps({ placeholder: 'Digite o PIN' })
  await act(async () => pin.props.onChange({ target: { value: '1234' } }))
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))

  await openKitchenDetail()
  await openOperationalPayment()
  let newSubmission
  await act(async () => { newSubmission = submitPayment(); await flush() })
  assert.equal(state.paymentPosts.length, 2)
  await act(async () => { state.paymentPosts[0].resolve(response(paidEffects(orderA))); await oldSubmission })

  assert.match(nodeText(renderer.root), /Cliente 602/)
  assert.equal(buttonNamed(renderer.root, 'Confirmar pagamento').props.disabled, true)
  assert.deepEqual(renderer.root.findByType(Orders).props.orders.map((order) => order.id), ['602'])
  await act(async () => { state.paymentPosts[1].resolve(response(paidEffects(orderB))); await newSubmission })
})

test('409 faz leitura oficial sem repetir POST e o estado oficial prevalece', async (t) => {
  const order = standaloneOrder('701')
  const { h, renderer, state, openKitchenDetail, openOperationalPayment, submitPayment } = await operationalWorkspace(t, { orders: [order] })
  const { default: Orders } = await h.load('/src/pages/Orders.jsx')

  await openKitchenDetail()
  await openOperationalPayment()
  const readsBefore = state.bootstrapCalls
  let submission
  await act(async () => { submission = submitPayment(); await flush() })
  state.bootstrapOrders = [paidEffects(order).order]
  await act(async () => { state.paymentPosts[0].resolve(response({ error: { message: 'Conflito' } }, 409)); await submission })

  assert.equal(state.paymentPosts.length, 1)
  assert.ok(state.bootstrapCalls > readsBefore)
  assert.equal(renderer.root.findByType(Orders).props.orders[0].paymentStatus, 'Pago')
  assert.equal(buttonNamed(renderer.root, 'Confirmar pagamento'), undefined)
})

test('resultado incerto faz leitura oficial, não repete POST e não marca Pago por otimismo', async (t) => {
  const order = standaloneOrder('801')
  const { h, renderer, state, openKitchenDetail, openOperationalPayment, submitPayment } = await operationalWorkspace(t, { orders: [order] })
  const { default: Orders } = await h.load('/src/pages/Orders.jsx')
  state.paymentHandler = async () => { throw new TypeError('network') }

  await openKitchenDetail()
  await openOperationalPayment()
  const readsBefore = state.bootstrapCalls
  await act(async () => { await submitPayment(); await flush() })

  assert.equal(state.paymentPosts.length, 1)
  assert.ok(state.bootstrapCalls > readsBefore)
  assert.equal(renderer.root.findByType(Orders).props.orders[0].paymentStatus, 'Pendente')
  assert.equal(buttonNamed(renderer.root, 'Confirmar pagamento').props.disabled, false)
  assert.match(nodeText(renderer.root), /network|Não foi possível/i)
})

test('A receber continua abrindo o mesmo diálogo central sem passar pela elegibilidade operacional', async (t) => {
  const order = standaloneOrder('901')
  const { h, renderer, navigate } = await operationalWorkspace(t, { orders: [order] })
  const { default: Receivables } = await h.load('/src/pages/Receivables.jsx')

  await navigate('A receber')
  await act(async () => renderer.root.findByType(Receivables).props.onRegisterPayment(order.id))
  assert.match(nodeText(renderer.root), /Registrar pagamento.*Cliente 901/s)
  assert.ok(buttonNamed(renderer.root, 'Confirmar pagamento'))
})

for (const [name, blockedOrder] of [
  ['Local legado', standaloneOrder('1001', { type: 'Local' })],
  ['pedido ligado a comanda', standaloneOrder('1002', { customerIdentityType: 'table', tableTabId: 'tab-1002', tableIdentifier: 'Mesa 2' })],
]) test(`${name} não expõe pagamento avulso no detalhe operacional`, async (t) => {
  const h = await workspaceHarness(t)
  const { default: Orders } = await h.load('/src/pages/Orders.jsx')
  const renderer = await h.render(Orders, {
    orders: [blockedOrder],
    now: new Date('2026-09-11T12:10:00.000Z'),
    search: '',
    onSearchChange() {},
    currency: (value) => `R$ ${value}`,
    onNewOrder() {},
    onFinalizeOrder() {},
    onCancelOrder() {},
    onNavigate() {},
    onNavigatePrintQueue() {},
    granted: new Set(['orders.view', 'payments.receive']),
    implemented: new Set(['orders', 'history']),
    onRegisterPayment() { throw new Error('pagamento avulso indevido') },
  })

  await act(async () => buttonNamed(renderer.root, 'Exibir detalhes').props.onClick())
  assert.equal(buttonNamed(renderer.root, 'Registrar pagamento'), undefined)
})
