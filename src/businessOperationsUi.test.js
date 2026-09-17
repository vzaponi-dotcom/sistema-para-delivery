import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'

import { buttonNamed, nodeText, renderWithNavigation, workspaceHarness } from './test-support/renderWorkspace.js'

const modalities = (...values) => values.map((value) => ({ value, label: value === 'Local' ? 'Consumo no local' : value }))
const client = { id: 'client-1', name: 'Ana', phone: '11999999999' }
const product = { id: 'product-1', name: 'Marmita', category: 'Refeições', presentationType: 'size', presentationValue: 'P', price: 30, isActive: true }
const baseNewOrderProps = {
  clients: [client], products: [product], tables: [{ id: 'table-1', name: 'Mesa 1', isActive: true, occupancy: 'free' }],
  currency: String, disabled: false, paymentOptions: [], defaultPaymentMethod: '',
  onCancel() {}, async onCreateClient() { return null }, async onSubmit() { return true }, onDraftDirtyChange() {},
}

test('a new common order uses only active modalities and the current default', async (t) => {
  const h = await workspaceHarness(t)
  const { default: NewOrder } = await h.load('/src/pages/NewOrder.jsx')
  const screen = await h.render(NewOrder, {
    ...baseNewOrderProps,
    modalityOptions: modalities('Retirada'),
    defaultModality: 'Retirada',
    modalityRevision: 7,
  })
  const group = screen.root.findByProps({ 'aria-label': 'Tipo do pedido' })
  assert.deepEqual(group.findAllByType('button').map((button) => nodeText(button)), ['Retirada'])
  assert.equal(buttonNamed(group, 'Retirada').props['aria-pressed'], true)
})

test('a policy refresh keeps a still-valid selection instead of reapplying the new default', async (t) => {
  const h = await workspaceHarness(t)
  const { default: NewOrder } = await h.load('/src/pages/NewOrder.jsx')
  const props = { ...baseNewOrderProps, modalityOptions: modalities('Entrega', 'Retirada'), defaultModality: 'Entrega', modalityRevision: 1 }
  const screen = await h.render(NewOrder, props)
  await act(async () => buttonNamed(screen.root.findByProps({ 'aria-label': 'Tipo do pedido' }), 'Retirada').props.onClick())
  await act(async () => screen.update(React.createElement(NewOrder, { ...props, defaultModality: 'Entrega', modalityRevision: 2 })))
  assert.equal(buttonNamed(screen.root.findByProps({ 'aria-label': 'Tipo do pedido' }), 'Retirada').props['aria-pressed'], true)
})

test('an open order keeps an inactive selection, cart and client until explicit review', async (t) => {
  const h = await workspaceHarness(t)
  const [{ default: NewOrder }, { default: NewOrderProductsStep }, { default: NewOrderReviewStep }] = await Promise.all([
    h.load('/src/pages/NewOrder.jsx'), h.load('/src/components/NewOrderProductsStep.jsx'), h.load('/src/components/NewOrderReviewStep.jsx'),
  ])
  const props = { ...baseNewOrderProps, modalityOptions: modalities('Entrega', 'Retirada'), defaultModality: 'Entrega', modalityRevision: 4 }
  const screen = await h.render(NewOrder, props)
  const types = screen.root.findByProps({ 'aria-label': 'Tipo do pedido' })
  await act(async () => buttonNamed(types, 'Retirada').props.onClick())
  await act(async () => buttonNamed(screen.root, 'Continuar →').props.onClick())
  await act(async () => screen.root.findByType(NewOrderProductsStep).props.onAdd(product))

  await act(async () => screen.update(React.createElement(NewOrder, {
    ...props, modalityOptions: modalities('Entrega'), defaultModality: 'Entrega', modalityRevision: 5,
  })))
  assert.equal(screen.root.findByType(NewOrderProductsStep).props.items.length, 1, 'cart stays intact')
  assert.match(nodeText(screen.root.findByProps({ role: 'alert' })), /Retirada.*não está mais ativa.*revise/i)

  await act(async () => screen.root.findByType(NewOrderProductsStep).props.onReview())
  const review = screen.root.findByType(NewOrderReviewStep)
  assert.equal(review.props.checkoutProps.canSubmit, false, 'inactive modality blocks confirmation')
  assert.match(review.props.customerSummary, /Ana.*Retirada/)
})

test('table context uses Local only while Local is active and otherwise requests review', async (t) => {
  const h = await workspaceHarness(t)
  const [{ default: NewOrder }, { default: NewOrderProductsStep }] = await Promise.all([
    h.load('/src/pages/NewOrder.jsx'), h.load('/src/components/NewOrderProductsStep.jsx'),
  ])
  const screen = await h.render(NewOrder, {
    ...baseNewOrderProps,
    initialTableId: 'table-1', expectedTableTabId: 'tab-1',
    modalityOptions: modalities('Entrega', 'Retirada'), defaultModality: 'Entrega', modalityRevision: 8,
  })
  assert.match(nodeText(screen.root.findByProps({ role: 'alert' })), /Consumo no local.*não está disponível.*revise/i)
  await act(async () => screen.root.findByType(NewOrderProductsStep).props.onBack())
  const group = screen.root.findByProps({ 'aria-label': 'Tipo do pedido' })
  assert.equal(buttonNamed(group, 'Consumo no local').props['aria-pressed'], true, 'table context is preserved for review')
  assert.equal(buttonNamed(screen.root, 'Continuar →').props.disabled, true)
})

test('POLICY_CHANGED keeps the prepared wizard and asks for modality review', async (t) => {
  const h = await workspaceHarness(t)
  const [{ default: NewOrder }, { default: NewOrderProductsStep }, { default: NewOrderReviewStep }] = await Promise.all([
    h.load('/src/pages/NewOrder.jsx'), h.load('/src/components/NewOrderProductsStep.jsx'), h.load('/src/components/NewOrderReviewStep.jsx'),
  ])
  let refreshes = 0
  const screen = await h.render(NewOrder, {
    ...baseNewOrderProps,
    modalityOptions: modalities('Entrega'), defaultModality: 'Entrega', modalityRevision: 2,
    async onSubmit() { return { ok: false, code: 'POLICY_CHANGED' } },
    onPolicyChanged() { refreshes += 1 },
  })
  await act(async () => buttonNamed(screen.root, 'Continuar →').props.onClick())
  await act(async () => screen.root.findByType(NewOrderProductsStep).props.onAdd(product))
  await act(async () => screen.root.findByType(NewOrderProductsStep).props.onReview())
  await act(async () => screen.root.findByType(NewOrderReviewStep).props.checkoutProps.onSavePending())
  assert.equal(refreshes, 1)
  assert.equal(screen.root.findByType(NewOrderReviewStep).props.checkoutProps.cartProps?.items?.length ?? 1, 1)
  assert.match(nodeText(screen.root.findByProps({ role: 'alert' })), /política.*alterada.*revise/i)
})

test('kitchen uses current timing while terminal analytics keep the T10 snapshot', async (t) => {
  const h = await workspaceHarness(t)
  const [{ default: Orders }, { default: OperationalHistoryAnalysis }] = await Promise.all([
    h.load('/src/pages/Orders.jsx'), h.load('/src/components/OperationalHistoryAnalysis.jsx'),
  ])
  const currentTiming = {
    scheduledPrepLeadMinutes: 30, scheduledLateGraceMinutes: 5,
    immediateLateAfterMinutes: 10, immediateVeryLateAfterMinutes: 15,
  }
  const scheduled = {
    id: 'scheduled-1', orderNumber: 1, client: 'Ana', type: 'Entrega', status: 'Em preparo', paymentStatus: 'Pendente',
    createdAt: '2026-09-13T11:00:00.000Z', scheduledFor: '2026-09-13T13:00:00.000Z', items: [],
  }
  const orders = await renderWithNavigation(h, Orders, {
    orders: [scheduled], officialOrders: [scheduled], now: new Date('2026-09-13T12:20:00.000Z'), search: '', onSearchChange() {},
    currency: String, onNewOrder() {}, onFinalizeOrder() {}, onCancelOrder() {}, onNavigate() {}, onNavigatePrintQueue() {},
    granted: new Set(['orders.view']), implemented: new Set(['orders']), printing: {}, currentTiming,
  })
  assert.match(nodeText(orders.root.findByProps({ 'aria-labelledby': 'kitchen-scheduled-heading' })), /Agendados para preparo \(1\)/)

  const terminal = {
    ...scheduled, id: 'terminal-1', status: 'Finalizado', scheduledFor: null,
    orderDate: '2026-09-13',
    createdAt: '2026-09-13T12:00:00.000Z', finishedAt: '2026-09-13T12:50:00.000Z',
    timingPolicySnapshot: {
      scheduledPrepLeadMinutes: 50, scheduledLateGraceMinutes: 15,
      immediateLateAfterMinutes: 30, immediateVeryLateAfterMinutes: 40,
    },
  }
  const history = await h.render(OperationalHistoryAnalysis, { orders: [terminal], period: 'today', now: new Date('2026-09-13T13:00:00.000Z'), currentTiming })
  assert.match(nodeText(history.root), /Tempo médio50 min/)
})
