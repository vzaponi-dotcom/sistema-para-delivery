import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { nodeText, workspaceHarness } from './test-support/renderWorkspace.js'

const allocations = [
  { methodCode: 'cash', methodLabel: 'Dinheiro', amountCents: 1200 },
  { methodCode: 'pix', methodLabel: 'Pix', amountCents: 3000 },
]

const paidOrder = {
  id: 'mixed-order', orderNumber: 30, client: 'Cliente misto', customerIdentityType: 'registered_client',
  type: 'Entrega', status: 'Finalizado', paymentStatus: 'Pago', paymentMethod: null, paymentAllocations: allocations,
  total: 42, paidAmount: 42, orderDate: '2026-09-21', createdAt: '2026-09-21T12:00:00.000Z',
  paidAt: '2026-09-21T12:01:00.000Z', items: [], adjustment: { type: 'none' },
}

test('payment badge and order detail render mixed allocation summary, rows and total', async (t) => {
  const h = await workspaceHarness(t)
  const [{ default: PaymentBadge }, { default: OrderDetail }] = await Promise.all([
    h.load('/src/domains/orders/ui/PaymentBadge.jsx'),
    h.load('/src/domains/orders/ui/components/OrderDetail.jsx'),
  ])
  const badge = await h.render(PaymentBadge, { order: paidOrder })
  assert.equal(nodeText(badge.root), 'Pago · 2 formas')

  const detail = await h.render(OrderDetail, {
    order: paidOrder,
    currency: (value) => `R$ ${Number(value).toFixed(2)}`,
    onClose() {},
    canCancelOrders: false,
    canExecutePrinting: false,
  })
  const text = nodeText(detail.root)
  assert.match(text, /Dinheiro.*R\$ 12\.00/)
  assert.match(text, /Pix.*R\$ 30\.00/)
  assert.match(text, /Total recebido.*R\$ 42\.00/)
})

test('A Receber shows mixed summary and finds the same paid order by either allocation method', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Receivables } = await h.load('/src/domains/finance/ui/Receivables.jsx')
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const orderPresentation = { formatOrderDate: (value) => value, getOrderItemsSearchText: () => '', getOrderItemsSummary: () => '' }
  const orderRules = {
    isOrderCancelled: () => false,
    isOrderPaid: (order) => order.paymentStatus === 'Pago',
    getPendingAmount: () => 0,
  }
  const renderWithSearch = (search) => React.createElement(NavigationProvider, {
    activeTab: 'receivables', granted: new Set(['finance.receivables']), implemented: new Set(['receivables']), moreOpen: false,
    requestNavigation() {}, openMore() {}, closeMore() {},
  }, React.createElement(Receivables, {
      orders: [paidOrder], movements: [], currency: String, orderPresentation, orderRules,
      queryState: { search, activeView: 'paid', timingFilter: 'all', sortMode: 'recent', exactDateFilter: null, selectedEntryKey: null },
      onQueryChange() {},
    }))
  const screen = await h.render(() => renderWithSearch('dinheiro'))
  assert.match(nodeText(screen.root), /Cliente misto/)
  assert.match(nodeText(screen.root), /Quitado · 2 formas/)
  await act(async () => screen.update(renderWithSearch('pix')))
  assert.match(nodeText(screen.root), /Cliente misto/)
})
