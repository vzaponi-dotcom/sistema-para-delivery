import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { buttonNamed, nodeText, workspaceHarness } from './test-support/renderWorkspace.js'

const flush = () => new Promise((resolve) => setImmediate(resolve))
const response = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
})
const currency = (value) => `R$ ${Number(value || 0).toFixed(2)}`
const client = { id: 'client-1', name: 'Ana Souza', phone: '(11) 99999-9999', address: 'Centro' }
const product = { id: 'product-1', name: 'Marmita', category: 'Refeicoes', presentationType: 'size', presentationValue: 'P', presentationUnit: '', price: 25 }
const preparingOrder = {
  id: 'order-preparing', orderNumber: 101, client: client.name, type: 'Retirada', status: 'Em preparo', paymentStatus: 'Pendente',
  orderDate: '2020-09-11', createdAt: '2020-09-11T12:00:00.000Z', subtotal: 25, total: 25,
  items: [{ id: 'item-1', productId: product.id, name: product.name, quantity: 1, unitPrice: 25 }],
}
const finalizedOrder = {
  ...preparingOrder, id: 'order-finalized', orderNumber: 102, status: 'Finalizado', finishedAt: '2020-09-11T12:30:00.000Z',
}
const paidOrder = {
  ...finalizedOrder, id: 'order-paid', orderNumber: 103, paymentStatus: 'Pago', paymentMethod: 'Pix', paidAmount: 25,
}
const tables = [
  { id: 'free', name: 'Varanda', isActive: true, occupancy: 'free', sortOrder: 1, openTableTab: null },
  { id: 'occupied', name: 'Mesa 7', isActive: true, occupancy: 'occupied', sortOrder: 2, openTableTab: { id: 'tab-42', number: 42, itemCount: 1, totalCents: 2500 } },
]
const bootstrap = {
  tables,
  tableTabs: [],
  orders: [preparingOrder, finalizedOrder, paidOrder],
  clients: [client],
  products: [product],
  movements: [{ id: 'movement-1', description: 'Caixa', type: 'entrada', value: 10, category: 'Outros', date: '2026-09-11', source: 'manual' }],
  financeSettings: null,
}

async function appWorkspace(t, capabilities, { withTheme = false, bootstrapData = bootstrap } = {}) {
  const h = await workspaceHarness(t)
  const requests = []
  let totalRequests = 0
  globalThis.fetch = async (path, options = {}) => {
    const url = String(path)
    const method = options.method || 'GET'
    totalRequests += 1
    if (totalRequests > 100) throw new Error(`Runaway request loop: ${url} ${method}`)
    if (method !== 'GET') requests.push({ url, method, body: options.body })
    if (url === '/api/auth/session') return response({ authenticated: true })
    if (url === '/api/bootstrap') return response(structuredClone(bootstrapData))
    if (url === '/api/orders') {
      if (method === 'GET') return response({ orders: structuredClone(bootstrapData.orders) })
      return response({ order: preparingOrder, movement: null, tableTab: null, tables })
    }
    if (url === '/api/printing/stations') return response({ stations: [{ id: 'test-station', name: 'Cozinha', platform: 'other', isPrimary: false, autoPrintEnabled: false }] })
    if (url.startsWith('/api/printing/jobs?')) return response({ jobs: [], pageInfo: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 } })
    if (url === '/api/printing/jobs/summary') return response({ summary: { pending: 0, awaitingConfirmation: 0, awaitingSecondCopy: 0, attention: 0 } })
    if (url === '/api/printing/settings') return response({ settings: { defaultCopies: 1 } })
    if (url.endsWith('/status')) return response({ order: { ...preparingOrder, status: 'Finalizado' } })
    if (url.endsWith('/cancel')) return response({ order: { ...paidOrder, status: 'Cancelado' }, movement: null, tableTab: null })
    if (url.endsWith('/payment')) return response({ order: { ...finalizedOrder, paymentStatus: 'Pago' }, movement: {}, tableTab: null })
    if (url.endsWith('/payment-promise')) return response({ order: { ...finalizedOrder, promisedPaymentDate: '2026-09-12' } })
    if (url.endsWith('/refund')) return response({ order: paidOrder, movement: {} })
    if (url === '/api/clients') return response({ client })
    if (url.startsWith('/api/clients/')) return method === 'DELETE' ? response({}) : response({ client })
    if (url === '/api/products') return response({ product })
    if (url.startsWith('/api/products/')) return method === 'DELETE' ? response({}) : response({ product })
    if (url === '/api/tables' || url === '/api/tables/order' || url.startsWith('/api/tables/')) return response({ tables })
    if (url === '/api/movements' || url.startsWith('/api/movements/')) return method === 'DELETE' ? response({ deletedMovementId: 'movement-1' }) : response({ movement: bootstrap.movements[0] })
    throw new Error(`Unexpected request: ${url} ${method}`)
  }

  const [{ default: App }, themeModule] = await Promise.all([
    h.load('/src/App.jsx'),
    withTheme ? h.load('/src/components/ThemeProvider.jsx') : Promise.resolve(null),
  ])
  if (withTheme) h.document.documentElement.dataset = {}
  const Root = withTheme
    ? () => React.createElement(themeModule.ThemeProvider, null, React.createElement(App, { capabilities }))
    : App
  const renderer = await h.render(Root, withTheme ? {} : { capabilities })
  return { h, renderer, requests }
}

const navigate = async (h, id) => act(async () => {
  h.window.dispatchEvent(Object.assign(new Event('app:navigate'), { detail: id }))
  await flush()
})
const mutations = (requests) => requests.filter(({ method }) => method !== 'GET')

describe('A8 action capabilities', { concurrency: false }, () => {

test('1. orders.view consulta a Cozinha sem oferecer ou iniciar novo pedido', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Orders } = await h.load('/src/pages/Orders.jsx')
  let starts = 0
  const renderer = await h.render(Orders, {
    orders: [], now: new Date('2026-09-11T12:00:00.000Z'), search: '', onSearchChange() {}, currency,
    canCreateOrders: false, onNewOrder: () => { starts += 1 }, granted: new Set(['orders.view']), implemented: new Set(['orders']),
  })
  assert.match(nodeText(renderer.root), /Cozinha/)
  assert.equal(Boolean(buttonNamed(renderer.root, 'Novo pedido')), false)
  assert.equal(starts, 0)
})

test('2. orders.view sem orders.finalize bloqueia UI e handler de finalizaÃ§Ã£o', async (t) => {
  const h = await workspaceHarness(t)
  const [{ default: Orders }, { default: KitchenTicket }, { default: ConfirmationDialog }] = await Promise.all([
    h.load('/src/pages/Orders.jsx'), h.load('/src/components/KitchenTicket.jsx'), h.load('/src/components/ConfirmationDialog.jsx'),
  ])
  let finalizations = 0
  const renderer = await h.render(Orders, {
    orders: [preparingOrder], now: new Date('2026-09-11T12:00:00.000Z'), search: '', onSearchChange() {}, currency,
    canFinalizeOrders: false, onFinalizeOrder: async () => { finalizations += 1 }, granted: new Set(['orders.view']), implemented: new Set(['orders']),
  })
  await act(async () => renderer.root.findByType(KitchenTicket).props.onFinalize(preparingOrder))
  assert.equal(finalizations, 0)
  assert.equal(renderer.root.findAllByType(ConfirmationDialog).length, 0)
})

test('3. orders.history continua visÃ­vel sem orders.analysis', async (t) => {
  const { h, renderer } = await appWorkspace(t, new Set(['orders.history']))
  const [{ default: OrderHistory }, { default: OperationalHistoryAnalysis }] = await Promise.all([h.load('/src/pages/OrderHistory.jsx'), h.load('/src/components/OperationalHistoryAnalysis.jsx')])
  assert.ok(renderer.root.findByType(OrderHistory))
  assert.match(nodeText(renderer.root), /Hist.rico/)
  assert.equal(renderer.root.findAllByType(OperationalHistoryAnalysis).length, 0)
})

test('4. orders.cancel permite cancelamento simples sem oferecer payments.refund', async (t) => {
  const h = await workspaceHarness(t)
  const [{ default: CancelOrderDialog }, { default: SystemSelect }] = await Promise.all([h.load('/src/components/CancelOrderDialog.jsx'), h.load('/src/components/SystemSelect.jsx')])
  const confirmed = []
  const renderer = await h.render(CancelOrderDialog, { open: true, order: paidOrder, canRefundPayments: false, onClose() {}, onConfirm: (payload) => confirmed.push(payload) })
  assert.equal(Boolean(buttonNamed(renderer.root, 'Sim')), false)
  await act(async () => renderer.root.findByType(SystemSelect).props.onChange('client_changed_mind'))
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  await act(async () => buttonNamed(renderer.root, 'Confirmar cancelamento definitivamente').props.onClick())
  assert.equal(confirmed.length, 1)
  assert.equal(confirmed[0].refundNow, false)
})

test('5. payments.receive abre recebimento no HistÃ³rico sem finance.receivables', async (t) => {
  const { renderer } = await appWorkspace(t, new Set(['orders.history', 'payments.receive']))
  await act(async () => buttonNamed(renderer.root, 'Ver detalhes').props.onClick())
  assert.ok(buttonNamed(renderer.root, 'Registrar pagamento'))
  assert.equal(Boolean(buttonNamed(renderer.root.findByProps({ 'aria-label': 'Menu principal' }), 'A receber')), false)
})

test('6. finance.receivables sem payments.receive preserva consulta e bloqueia recebimento', async (t) => {
  const { h, renderer, requests } = await appWorkspace(t, new Set(['finance.receivables']))
  const { default: Receivables } = await h.load('/src/pages/Receivables.jsx')
  const page = renderer.root.findByType(Receivables)
  assert.match(nodeText(renderer.root), /A receber/)
  assert.equal(page.props.canReceivePayments, false)
  assert.equal(page.props.canExecutePrinting, false)
  const before = mutations(requests).length
  let result
  await act(async () => { result = page.props.onRegisterPayment(finalizedOrder.id) })
  assert.equal(result, false)
  assert.equal(mutations(requests).length, before)
})

test('7. clients.view mantÃ©m consulta e bloqueia CRUD sem clients.manage', async (t) => {
  const { h, renderer, requests } = await appWorkspace(t, new Set(['clients.view']))
  const { default: Clients } = await h.load('/src/pages/Clients.jsx')
  const page = renderer.root.findByType(Clients)
  assert.match(nodeText(renderer.root), /Ana Souza/)
  assert.equal(Boolean(buttonNamed(renderer.root, 'Novo cliente')), false)
  const before = mutations(requests).length
  assert.equal(page.props.onAdd(), false)
  assert.equal(page.props.onEdit(client), false)
  await page.props.onDelete(client.id)
  assert.equal(mutations(requests).length, before)
})

test('8. products.view mantÃ©m catÃ¡logo e bloqueia CRUD sem products.manage', async (t) => {
  const { h, renderer, requests } = await appWorkspace(t, new Set(['products.view']))
  const { default: Products } = await h.load('/src/pages/Products.jsx')
  const page = renderer.root.findByType(Products)
  assert.match(nodeText(renderer.root), /Produtos e pre.os/)
  assert.equal(Boolean(buttonNamed(renderer.root, 'Adicionar produto')), false)
  assert.equal(Boolean(buttonNamed(renderer.root, 'Selecionar')), false)
  const before = mutations(requests).length
  assert.equal(page.props.onAdd(), false)
  assert.equal(page.props.onEdit(product), false)
  await page.props.onDelete(product.id)
  assert.equal(mutations(requests).length, before)
})

test('9. montar pedido consulta produtos sem products.manage e nÃ£o injeta ajuste sem orders.discount', async (t) => {
  const h = await workspaceHarness(t)
  const [{ default: NewOrder }, { default: NewOrderProductsStep }, { default: NewOrderReviewStep }, { default: OrderCheckoutSummary }] = await Promise.all([
    h.load('/src/pages/NewOrder.jsx'), h.load('/src/components/NewOrderProductsStep.jsx'), h.load('/src/components/NewOrderReviewStep.jsx'), h.load('/src/components/OrderCheckoutSummary.jsx'),
  ])
  const renderer = await h.render(NewOrder, {
    clients: [client], products: [product], tables, initialTableId: 'occupied', currency, disabled: false,
    canManageClients: false, canAdjustOrders: false, onCancel() {}, onCreateClient: async () => client, onSubmit: async () => true, onDraftDirtyChange() {},
  })
  let productsStep = renderer.root.findByType(NewOrderProductsStep)
  assert.deepEqual(productsStep.props.products.map((item) => item.id), [product.id])
  await act(async () => productsStep.props.onAdd(product))
  productsStep = renderer.root.findByType(NewOrderProductsStep)
  await act(async () => productsStep.props.onReview())
  const review = renderer.root.findByType(NewOrderReviewStep)
  await act(async () => review.props.checkoutProps.onAdjustmentChange({ type: 'discount' }))
  const checkout = renderer.root.findByType(OrderCheckoutSummary)
  assert.equal(checkout.props.draft.adjustment.type, 'none')
  assert.equal(buttonNamed(renderer.root, 'Salvar pedido').props.disabled, false)
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Ajuste do pedido' }).length, 0)
})

test('10. tables.view mantÃ©m consulta e Ver comanda sem tables.manage', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Tables } = await h.load('/src/pages/Tables.jsx')
  let opened = 0
  const renderer = await h.render(Tables, { tables, disabled: false, canManageTables: false, canOpenComanda: true, onCreate() {}, onRename() {}, onSetActive() {}, onReorder() {}, onOpenComanda: () => { opened += 1 } })
  assert.match(nodeText(renderer.root), /Mesa 7/)
  assert.equal(renderer.root.findAllByProps({ className: 'table-create-form' }).length, 0)
  assert.equal(Boolean(buttonNamed(renderer.root, 'Renomear')), false)
  await act(async () => buttonNamed(renderer.root, 'Ver comanda').props.onClick())
  assert.equal(opened, 1)
})

test('11. comandas.transfer continua disponÃ­vel sem tables.manage', async (t) => {
  const h = await workspaceHarness(t)
  const { default: ComandaDetail } = await h.load('/src/components/ComandaDetail.jsx')
  let transfers = 0
  const detail = { number: 42, status: 'open', table: { name: 'Mesa 7' }, openedAt: '2026-09-11T12:00:00.000Z', orderCount: 1, itemCount: 1, totalCents: 2500, items: [] }
  const renderer = await h.render(ComandaDetail, { detail, currency, canTransfer: true, canCreateOrders: false, canExecutePrinting: false, onTransfer: () => { transfers += 1 } })
  await act(async () => buttonNamed(renderer.root, 'Transferir comanda').props.onClick())
  assert.equal(transfers, 1)
})

test('12. finance.movements preserva consulta e bloqueia mutaÃ§Ã£o sem manage', async (t) => {
  const { h, renderer, requests } = await appWorkspace(t, new Set(['finance.movements']))
  const { default: Finance } = await h.load('/src/pages/Finance.jsx')
  const page = renderer.root.findByType(Finance)
  assert.match(nodeText(renderer.root), /Caixa/)
  assert.equal(Boolean(buttonNamed(renderer.root, 'Novo movimento')), false)
  const before = mutations(requests).length
  assert.equal(page.props.onAddMovement(), false)
  assert.equal(mutations(requests).length, before)
})

test('13. finance.receivables bloqueia promessa sem finance.promises.manage', async (t) => {
  const { h, renderer, requests } = await appWorkspace(t, new Set(['finance.receivables']))
  const { default: Receivables } = await h.load('/src/pages/Receivables.jsx')
  const page = renderer.root.findByType(Receivables)
  assert.equal(page.props.canManagePaymentPromises, false)
  const before = mutations(requests).length
  let result
  await act(async () => { result = await page.props.onUpdatePaymentPromise(finalizedOrder.id, '2026-09-12') })
  assert.equal(result, false)
  assert.equal(mutations(requests).length, before)
})

async function printQueueWorkspace(t, { canExecutePrinting, canDiscardPrinting }) {
  const h = await workspaceHarness(t)
  const job = { id: 'job-1', type: 'order', orderId: preparingOrder.id, status: 'pending', trigger: 'automatic', priority: 2, copiesRequested: 1, copiesPrinted: 0, createdAt: '2026-09-11T12:00:00.000Z', document: { type: 'order', customer: { name: client.name }, order: { id: preparingOrder.id } } }
  globalThis.fetch = async (path) => {
    const url = String(path)
    if (url.startsWith('/api/printing/jobs?')) return response({ jobs: [job], pageInfo: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } })
    if (url === '/api/printing/jobs/summary') return response({ summary: { pending: 1, awaitingConfirmation: 0, awaitingSecondCopy: 0, attention: 0 } })
    throw new Error(`Unexpected request: ${url}`)
  }
  const { default: PrintQueue } = await h.load('/src/pages/PrintQueue.jsx')
  const calls = { execute: 0, discard: 0 }
  const printing = {
    localStation: null, printerHealth: { state: 'verifying' }, stations: [],
    requestPrintNow: async () => { calls.execute += 1 }, requestDiscard: async () => { calls.discard += 1 },
  }
  const renderer = await h.render(PrintQueue, {
    orders: [preparingOrder], printing, canExecutePrinting, canDiscardPrinting,
    queryState: { search: '', status: '', trigger: '', sortBy: 'createdAt', sortDir: 'desc', page: 1, pageSize: 10 }, onQueryChange() {},
  })
  await act(flush)
  await act(async () => renderer.root.findByProps({ className: 'print-queue-job-row' }).props.onClick())
  return { renderer, calls }
}

test('14. printing.queue sem printing.execute nÃ£o dispara execuÃ§Ã£o manual', async (t) => {
  const { renderer, calls } = await printQueueWorkspace(t, { canExecutePrinting: false, canDiscardPrinting: false })
  const action = buttonNamed(renderer.root, 'Imprimir agora')
  assert.equal(action.props.disabled, true)
  await act(async () => action.props.onClick())
  assert.equal(calls.execute, 0)
})

test('15. printing.execute permite execuÃ§Ã£o e printing.discard ausente bloqueia descarte', async (t) => {
  const { renderer, calls } = await printQueueWorkspace(t, { canExecutePrinting: true, canDiscardPrinting: false })
  const printNow = buttonNamed(renderer.root, 'Imprimir agora')
  const discard = buttonNamed(renderer.root, 'Descartar')
  assert.equal(printNow.props.disabled, false)
  assert.equal(discard.props.disabled, true)
  await act(async () => discard.props.onClick())
  assert.equal(calls.discard, 0)
  await act(async () => { printNow.props.onClick(); await flush() })
  assert.equal(calls.execute, 1)
})

test('16. printing.settings permite vias e bloqueia estaÃ§Ã£o sem station.configure', async (t) => {
  const h = await workspaceHarness(t)
  const { default: PrintingSettingsContent } = await h.load('/src/components/PrintingSettingsContent.jsx')
  const idle = (value) => ({ status: 'idle', confirmedValue: value, error: '', revision: 0, owner: null })
  const settings = { resources: { 'business-copies': idle(1), 'station-config': idle({ id: 'station-1', name: 'Cozinha', platform: 'windows', autoPrintEnabled: false }), 'local-printer': idle('Fila A') }, reload() {}, saveCopies() {}, saveStation() {}, makePrimary() {}, selectPrinter() {} }
  const printing = { localStation: settings.resources['station-config'].confirmedValue, configuredPrinterName: 'Fila A', platform: 'windows', availablePrinters: ['Fila A'], printerHealth: { state: 'ready' } }
  const renderer = await h.render(PrintingSettingsContent, { printing, settings, granted: new Set(['printing.settings']) })
  assert.equal(renderer.root.findAllByProps({ name: 'defaultCopies' }).length, 2)
  assert.equal(Boolean(buttonNamed(renderer.root, 'Configurar impressora')), false)
  assert.equal(Boolean(buttonNamed(renderer.root, 'Tornar estaÃ§Ã£o principal')), false)
})

test('17. preferences.local altera tema e som sem capacidades de impressÃ£o', async (t) => {
  const { h, renderer } = await appWorkspace(t, new Set(['preferences.local']), { withTheme: true })
  await act(async () => buttonNamed(renderer.root, 'Escuro').props.onClick())
  assert.equal(h.window.localStorage.getItem('delivery-theme'), 'dark')
  const sound = renderer.root.findAllByType('input').find((node) => node.props.type === 'checkbox')
  await act(async () => sound.props.onChange({ target: { checked: false } }))
  assert.equal(h.window.localStorage.getItem('kitchen-sound-enabled'), 'false')
  assert.equal(renderer.root.findAllByProps({ name: 'defaultCopies' }).length, 0)
})

test('18. conjunto vazio nÃ£o recebe fallback de legacyCapabilities', async (t) => {
  const { h, renderer } = await appWorkspace(t, new Set())
  const pageModules = await Promise.all(['Orders', 'OrderHistory', 'Clients', 'Products', 'Receivables', 'Finance', 'Tables', 'Comandas', 'PrintQueue'].map((name) => h.load(`/src/pages/${name}.jsx`)))
  assert.equal(pageModules.reduce((count, module) => count + renderer.root.findAllByType(module.default).length, 0), 0)
  assert.ok(buttonNamed(renderer.root, 'Sair do sistema'))
})

test('19. capability desconhecida nÃ£o concede aÃ§Ã£o nem invalida conhecida', async (t) => {
  const { h, renderer } = await appWorkspace(t, new Set(['clients.view', 'unknown.capability']))
  const { default: Clients } = await h.load('/src/pages/Clients.jsx')
  assert.ok(renderer.root.findByType(Clients))
  assert.match(nodeText(renderer.root), /Ana Souza/)
  assert.equal(Boolean(buttonNamed(renderer.root, 'Novo cliente')), false)
})

test('20. callbacks diretos sem capability geram zero mutaÃ§Ãµes ou fluxos de ediÃ§Ã£o', async (t) => {
  const capabilities = new Set(['orders.history', 'clients.view', 'products.view', 'tables.view', 'comandas.view', 'finance.overview', 'finance.receivables', 'finance.movements', 'printing.queue'])
  const { h, renderer, requests } = await appWorkspace(t, capabilities)
  const modules = Object.fromEntries(await Promise.all(['OrderHistory', 'Dashboard', 'NewOrderRoute', 'Clients', 'Products', 'Tables', 'Receivables', 'Finance'].map(async (name) => [name, (await h.load(`/src/pages/${name}.jsx`)).default])))
  const before = mutations(requests).length
  let page = renderer.root.findByType(modules.OrderHistory)
  await act(async () => {
    assert.equal(await page.props.onCancelOrder(paidOrder.id, { reason: 'other', note: 'x', refundNow: true, refundMethod: 'Pix' }), false)
    assert.equal(page.props.onRegisterPayment(finalizedOrder.id, 'history'), false)
  })
  await navigate(h, 'clients')
  page = renderer.root.findByType(modules.Clients)
  await act(async () => { assert.equal(page.props.onAdd(), false); assert.equal(page.props.onEdit(client), false); assert.equal(await page.props.onDelete(client.id), false) })
  await navigate(h, 'products')
  page = renderer.root.findByType(modules.Products)
  await act(async () => { assert.equal(page.props.onAdd(), false); assert.equal(page.props.onEdit(product), false); assert.equal(await page.props.onDelete(product.id), false) })
  await navigate(h, 'tables')
  page = renderer.root.findByType(modules.Tables)
  await act(async () => { assert.equal(await page.props.onCreate('Nova'), false); assert.equal(await page.props.onRename('free', 'Nova'), false); assert.equal(await page.props.onSetActive('free', false), false); assert.equal(await page.props.onReorder(['occupied', 'free']), false) })
  await navigate(h, 'receivables')
  page = renderer.root.findByType(modules.Receivables)
  await act(async () => { assert.equal(page.props.onRegisterPayment(finalizedOrder.id), false); assert.equal(await page.props.onUpdatePaymentPromise(finalizedOrder.id, '2026-09-12'), false) })
  await navigate(h, 'finance')
  page = renderer.root.findByType(modules.Finance)
  await act(async () => { assert.equal(page.props.onAddMovement(), false); assert.equal(await page.props.onRegisterRefund(paidOrder.id, { method: 'Pix' }), false) })
  await navigate(h, 'dashboard')
  page = renderer.root.findByType(modules.Dashboard)
  await act(async () => { assert.equal(page.props.onNewOrder(), false) })
  assert.equal(renderer.root.findAllByType(modules.NewOrderRoute).length, 0)
  assert.equal(mutations(requests).length, before)
})
})
