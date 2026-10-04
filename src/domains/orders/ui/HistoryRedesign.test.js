import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness, renderWithNavigation, nodeText, buttonNamed } from '../../../test-support/renderWorkspace.js'

const order = { id: 'history-1', orderNumber: 1, client: 'Ana', type: 'Retirada', status: 'Cancelado', total: 20, subtotal: 20, paymentStatus: 'Pendente', createdAt: '2026-10-04T15:00:00Z', cancelledAt: '2026-10-04T16:00:00Z', items: [{ id: 'line', name: 'Café', quantity: 2, unitPrice: 10, note: 'Sem açúcar' }], attribution: { createdBy: { type: 'user', displayName: 'Joana' } } }

test('cancelled detail never offers cancellation or collection and preserves truthful actor and item notes', async t => {
  const h = await workspaceHarness(t)
  const { default: OrderDetail } = await h.load('/src/domains/orders/ui/components/OrderDetail.jsx')
  const renderer = await h.render(OrderDetail, { order, currency: n => `R$ ${n}`, canCancelOrders: true, canRegisterPayment: true, onRequestCancel() {}, onRegisterPayment() {} })
  assert.equal(Boolean(buttonNamed(renderer.root, 'Cancelar pedido')), false)
  assert.equal(Boolean(buttonNamed(renderer.root, 'Registrar pagamento')), false)
  assert.match(nodeText(renderer.root), /Criado porJoana/)
  assert.match(nodeText(renderer.root), /Sem açúcar/)
  assert.match(nodeText(renderer.root), /Não recebido/)
})

test('history displays only payment status and opens details through the whole row or menu', async t => {
  const h = await workspaceHarness(t)
  const { default: OrderHistory } = await h.load('/src/domains/orders/ui/OrderHistory.jsx')
  const renderer = await renderWithNavigation(h, OrderHistory, { orders: [{ ...order, status: 'Finalizado', finishedAt: order.cancelledAt, paymentStatus: 'Pago', paymentMethod: 'Pix' }], queryState: { filter: 'all', period: 'all' }, onQueryChange() {}, granted: new Set(['orders.history']), implemented: new Set(['history']) })
  assert.doesNotMatch(nodeText(renderer.root.findByType('article')), /Pix/)
  assert.equal(renderer.root.findAllByType('button').some(node => node.props['aria-label']?.startsWith('Ver detalhes do Pedido')), false)
  await act(async () => renderer.root.findByType('article').props.onClick({ target: { closest: () => null } }))
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 1)
  await act(async () => buttonNamed(renderer.root, 'Fechar').props.onClick())
  await act(async () => buttonNamed(renderer.root, 'Mais ações do Pedido #1').props.onClick())
  const menu = renderer.root.findByProps({ role: 'menu' })
  assert.match(nodeText(menu), /Ver detalhes/)
  assert.match(nodeText(menu), /Cancelar pedido/)
})

test('history PDF and reprint shortcuts execute their commands without opening order details', async t => {
  const h = await workspaceHarness(t)
  const { default: OrderHistory } = await h.load('/src/domains/orders/ui/OrderHistory.jsx')
  const calls = [], document = { order: { number: 1 } }
  const job = { id: 'printed-job', type: 'order', status: 'printed', copiesPrinted: 2, copiesRequested: 2 }
  const printing = { latestJobByOrderId: new Map([[order.id, job]]), getPreviewDocument: async id => { calls.push(['preview', id]); return document }, downloadOrderPdf: doc => calls.push(['pdf', doc]), requestReprint: async (job, copies) => calls.push(['reprint', job.id, copies]) }
  const renderer = await renderWithNavigation(h, OrderHistory, { orders: [{ ...order, status: 'Finalizado', finishedAt: order.cancelledAt }], queryState: { period: 'all' }, printing })
  await act(async () => buttonNamed(renderer.root, 'Mais ações do Pedido #1').props.onClick())
  await act(async () => buttonNamed(renderer.root, 'Gerar PDF').props.onClick())
  assert.deepEqual(calls, [['preview', order.id], ['pdf', document]])
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0)
  await act(async () => buttonNamed(renderer.root, 'Mais ações do Pedido #1').props.onClick())
  await act(async () => buttonNamed(renderer.root, 'Reimprimir').props.onClick())
  assert.equal(renderer.root.findByProps({ role: 'dialog' }).props['aria-label'], 'Confirmar reimpressão')
  assert.equal(calls.length, 2)
  await act(async () => buttonNamed(renderer.root, 'Reimprimir').props.onClick())
  assert.deepEqual(calls.at(-1), ['reprint', job.id, 2])
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0)
})

test('history shortcuts respect force-print permission even through direct callbacks', async t => {
  const h = await workspaceHarness(t)
  const { default: OrderHistory } = await h.load('/src/domains/orders/ui/OrderHistory.jsx')
  let forced = 0
  const job = { id: 'blocked-job', type: 'order', status: 'attention', queueState: 'attention', lastError: { code: 'ORDER_FINALIZED_BEFORE_PRINT' } }
  const renderer = await renderWithNavigation(h, OrderHistory, { orders: [{ ...order, status: 'Finalizado', finishedAt: order.cancelledAt }], queryState: { period: 'all' }, canForcePrinting: false, printing: { latestJobByOrderId: new Map([[order.id, job]]), requestForcePrint: async () => { forced++ } } })
  await act(async () => buttonNamed(renderer.root, 'Mais ações do Pedido #1').props.onClick())
  const force = buttonNamed(renderer.root, 'Imprimir mesmo assim')
  assert.ok(force)
  assert.equal(force.props.disabled, true)
  await act(async () => force.props.onClick())
  assert.equal(forced, 0)
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0)
})

test('cancellation is separated from totals in the fixed detail footer', async t => {
  const h = await workspaceHarness(t)
  const { default: OrderDetail } = await h.load('/src/domains/orders/ui/components/OrderDetail.jsx')
  const { default: Modal } = await h.load('/src/shared/ui/Modal.jsx')
  const renderer = await h.render(OrderDetail, { order: { ...order, status: 'Finalizado' }, currency: n => `R$ ${n}`, onRequestCancel() {} })
  assert.equal(Boolean(buttonNamed(renderer.root.findByProps({ className: 'order-detail-section order-detail-values-section' }), 'Cancelar pedido')), false)
  assert.ok(renderer.root.findByType(Modal).props.footer)
  assert.ok(buttonNamed(renderer.root.findByProps({ className: 'modal-footer' }), 'Cancelar pedido'))
})

test('pending detail keeps cancellation and payment together without a third footer action', async t => {
  const h = await workspaceHarness(t)
  const { default: OrderDetail } = await h.load('/src/domains/orders/ui/components/OrderDetail.jsx')
  const renderer = await h.render(OrderDetail, { order: { ...order, status: 'Finalizado' }, currency: n => `R$ ${n}`, onRequestCancel() {}, canRegisterPayment: true, onRegisterPayment() {} })
  const footer = renderer.root.findByProps({ className: 'modal-footer' })
  assert.equal(footer.findAllByType('button').length, 2)
  assert.ok(buttonNamed(footer, 'Cancelar pedido'))
  assert.ok(buttonNamed(footer, 'Registrar pagamento'))
})

for (const scenario of [
  { job: null, label: 'Imprimir pedido', command: 'printOrder', confirmation: 'Imprimir' },
  { job: { id: 'failed', type: 'order', status: 'failed' }, label: 'Tentar novamente', command: 'requestRetry' },
  { job: { id: 'second', type: 'order', status: 'awaiting_second_copy', copiesPrinted: 1, copiesRequested: 2 }, label: 'Imprimir 2ª via', command: 'requestSecondCopy' },
]) test(`history uses the current queue command for ${scenario.label}`, async t => {
  const h = await workspaceHarness(t)
  const { default: OrderHistory } = await h.load('/src/domains/orders/ui/OrderHistory.jsx')
  const calls = []
  const printing = { latestJobByOrderId: new Map(scenario.job ? [[order.id, scenario.job]] : []), [scenario.command]: async (...args) => calls.push(args) }
  const renderer = await renderWithNavigation(h, OrderHistory, { orders: [{ ...order, status: 'Finalizado', finishedAt: order.cancelledAt }], queryState: { period: 'all' }, printing })
  await act(async () => buttonNamed(renderer.root, 'Mais ações do Pedido #1').props.onClick())
  await act(async () => buttonNamed(renderer.root, scenario.label).props.onClick())
  if (scenario.confirmation) {
    assert.equal(calls.length, 0)
    await act(async () => buttonNamed(renderer.root, scenario.confirmation).props.onClick())
  }
  assert.deepEqual(calls, scenario.job ? [[scenario.job]] : [[order.id, 2]])
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0)
})

test('history prevents duplicate PDF actions while the current document is loading', async t => {
  const h = await workspaceHarness(t)
  const { default: OrderHistory } = await h.load('/src/domains/orders/ui/OrderHistory.jsx')
  let resolveDocument, previews = 0, downloads = 0
  const document = new Promise(resolve => { resolveDocument = resolve })
  const printing = { getPreviewDocument: () => { previews++; return document }, downloadOrderPdf: () => { downloads++ } }
  const renderer = await renderWithNavigation(h, OrderHistory, { orders: [{ ...order, status: 'Finalizado', finishedAt: order.cancelledAt }], queryState: { period: 'all' }, printing })
  await act(async () => buttonNamed(renderer.root, 'Mais ações do Pedido #1').props.onClick())
  const click = buttonNamed(renderer.root, 'Gerar PDF').props.onClick
  let first
  await act(async () => { first = click(); assert.equal(click(), false) })
  assert.equal(previews, 1)
  assert.equal(downloads, 0)
  await act(async () => { resolveDocument({ order: { number: 1 } }); await first })
  assert.equal(downloads, 1)
})
