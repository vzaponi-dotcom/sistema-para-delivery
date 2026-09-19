import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'

import { buttonNamed, nodeText, workspaceHarness } from './test-support/renderWorkspace.js'

const response = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
})

const options = [
  { value: 'Pix', label: 'Pix', code: 'pix' },
  { value: 'Dinheiro', label: 'Dinheiro', code: 'cash' },
]

const effective = (methods = options, defaultMethod = 'pix') => ({
  version: 'payment-v1', revisions: { paymentMethods: 1 },
  paymentMethods: { methods, defaultMethod },
})

test('effective payment projection produces ordered value, label and stable code for active choices', async () => {
  const { paymentOptionsFromEffective, paymentDefaultFromEffective } = await import('./utils/paymentMethodOptions.js')
  const config = effective([
    { value: 'Dinheiro', label: 'Dinheiro', code: 'cash' },
    { value: 'Pix', label: 'Pix', code: 'pix' },
  ], 'cash')
  assert.deepEqual(paymentOptionsFromEffective(config), [
    { value: 'Dinheiro', label: 'Dinheiro', code: 'cash' },
    { value: 'Pix', label: 'Pix', code: 'pix' },
  ])
  assert.equal(paymentDefaultFromEffective(config), 'Dinheiro')
  assert.deepEqual(paymentOptionsFromEffective(null), [])
})

test('an open comanda payment keeps its choice across default changes and warns if it becomes inactive', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Dialog } = await h.load('/src/app/workflows/payments/table-tab/TableTabPaymentDialog.jsx')
  const detail = { id: 'tab-42', number: 42, table: { name: 'Mesa 7' }, status: 'open', orderCount: 1, totalCents: 2500 }
  const confirmations = []
  const props = { open: true, detail, currency: String, paymentOptions: options, defaultPaymentMethod: 'Pix', onClose() {}, onConfirm: (...args) => confirmations.push(args) }
  const screen = await h.render(Dialog, props)
  assert.equal(nodeText(screen.root.findByProps({ role: 'combobox' })), 'Pix')

  await act(async () => screen.root.findByProps({ role: 'combobox' }).props.onClick())
  await act(async () => buttonNamed(screen.root, 'Dinheiro').props.onClick())
  await act(async () => screen.update(React.createElement(Dialog, { ...props, defaultPaymentMethod: 'Dinheiro' })))
  assert.equal(nodeText(screen.root.findByProps({ role: 'combobox', 'aria-label': 'Forma de pagamento' })), 'Dinheiro')

  await act(async () => screen.update(React.createElement(Dialog, {
    ...props, paymentOptions: [options[0]], defaultPaymentMethod: 'Pix',
  })))
  assert.match(nodeText(screen.root.findByProps({ role: 'combobox' })), /Dinheiro/)
  assert.match(nodeText(screen.root), /não está mais ativa.*revise/i)
  await act(async () => screen.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.deepEqual(confirmations, [], 'an inactive open selection cannot be submitted without review')
})

test('a newly opened payment uses the latest default instead of a Pix fallback', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Dialog } = await h.load('/src/app/workflows/payments/table-tab/TableTabPaymentDialog.jsx')
  const detail = { id: 'tab-42', number: 42, table: { name: 'Mesa 7' }, status: 'open', orderCount: 1, totalCents: 2500 }
  const screen = await h.render(Dialog, { open: false, detail, currency: String, paymentOptions: options, defaultPaymentMethod: 'Dinheiro', onClose() {}, onConfirm() {} })
  await act(async () => screen.update(React.createElement(Dialog, { open: true, detail, currency: String, paymentOptions: options, defaultPaymentMethod: 'Dinheiro', onClose() {}, onConfirm() {} })))
  assert.equal(nodeText(screen.root.findByProps({ role: 'combobox', 'aria-label': 'Forma de pagamento' })), 'Dinheiro')
})

test('historical refund keeps the persisted original method even when it is inactive', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Dialog } = await h.load('/src/app/workflows/refunds/RegisterRefundDialog.jsx')
  const order = { id: 'order-1', orderNumber: 1, client: 'Ana', paymentMethod: 'Transferência', paidAmount: 40 }
  const confirmations = []
  const screen = await h.render(Dialog, { open: true, order, paymentOptions: options, onClose() {}, onConfirm: (payload) => confirmations.push(payload) })
  assert.match(nodeText(screen.root.findByProps({ role: 'combobox' })), /Transferência/)
  assert.match(nodeText(screen.root), /método original.*inativo/i)
  assert.equal(buttonNamed(screen.root, 'Confirmar estorno').props.disabled, true)
  await act(async () => screen.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.deepEqual(confirmations, [])

  await act(async () => screen.root.findByProps({ role: 'combobox' }).props.onClick())
  await act(async () => buttonNamed(screen.root, 'Dinheiro').props.onClick())
  await act(async () => screen.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.deepEqual(confirmations, [{ refundMethod: 'Dinheiro' }])
})

test('a new cash movement remains empty and requires an explicit active payment choice', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Dialog } = await h.load('/src/domains/finance/ui/MovementDialog.jsx')
  const screen = await h.render(Dialog, {
    open: true, today: '2026-09-13', paymentOptions: [options[1]], defaultPaymentMethod: 'Dinheiro', onClose() {}, onSubmit() {},
  })
  assert.equal(nodeText(screen.root.findByProps({ 'aria-label': 'Forma ou meio' })), 'Selecione a forma / meio')
  assert.equal(buttonNamed(screen.root, 'Revisar movimento').props.disabled, true)
})

test('checkout applies the current default only when opening a new payment choice', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Checkout } = await h.load('/src/domains/orders/ui/components/OrderCheckoutSummary.jsx')
  const base = {
    draft: { type: 'Retirada', adjustment: { type: 'none', mode: 'fixed', value: '', reason: '' } },
    preview: { subtotal: 20, deliveryFee: 0, adjustmentAmount: 0, total: 20 },
    currency: String, canSubmit: true, paymentOptions: options, defaultPaymentMethod: 'Dinheiro',
    onDeliveryFeeChange() {}, onAdjustmentChange() {}, onSavePending() {}, onSavePaid() {},
  }
  const screen = await h.render(Checkout, base)
  await act(async () => buttonNamed(screen.root, 'Salvar e receber').props.onClick())
  assert.equal(nodeText(screen.root.findByProps({ role: 'combobox', 'aria-label': 'Forma de pagamento' })), 'Dinheiro')
  await act(async () => screen.update(React.createElement(Checkout, { ...base, defaultPaymentMethod: 'Pix' })))
  assert.equal(nodeText(screen.root.findByProps({ role: 'combobox', 'aria-label': 'Forma de pagamento' })), 'Dinheiro')
  await act(async () => screen.update(React.createElement(Checkout, { ...base, paymentOptions: [options[0]], defaultPaymentMethod: 'Pix' })))
  assert.match(nodeText(screen.root.findByProps({ role: 'combobox', 'aria-label': 'Forma de pagamento' })), /Dinheiro/)
  assert.match(nodeText(screen.root), /não está mais ativa.*revise/i)
})

test('cancellation refund starts from the persisted method and never silently substitutes Pix', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Dialog } = await h.load('/src/domains/orders/ui/components/CancelOrderDialog.jsx')
  const order = { id: 'order-2', orderNumber: 2, client: 'Bia', paymentStatus: 'Pago', paymentMethod: 'Transferência' }
  const screen = await h.render(Dialog, { open: true, order, paymentOptions: options, onClose() {}, onConfirm() {} })
  await act(async () => buttonNamed(screen.root, 'Sim').props.onClick())
  assert.match(nodeText(screen.root.findByProps({ role: 'combobox', 'aria-label': 'Forma do estorno' })), /Transferência/)
  assert.match(nodeText(screen.root), /método original.*inativo/i)
  assert.equal(buttonNamed(screen.root, 'Revisar cancelamento').props.disabled, true)
})

test('cancellation without a persisted method requires an explicit refund choice', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Dialog } = await h.load('/src/domains/orders/ui/components/CancelOrderDialog.jsx')
  const order = { id: 'order-3', orderNumber: 3, client: 'Caio', paymentStatus: 'Pago', paymentMethod: '' }
  const screen = await h.render(Dialog, { open: true, order, paymentOptions: options, onClose() {}, onConfirm() {} })
  await act(async () => buttonNamed(screen.root, 'Sim').props.onClick())
  assert.equal(nodeText(screen.root.findByProps({ role: 'combobox', 'aria-label': 'Forma do estorno' })), 'Selecione')
  assert.doesNotMatch(nodeText(screen.root.findByProps({ role: 'combobox', 'aria-label': 'Forma do estorno' })), /Pix/)
})

test('App opens new operational payments with the effective default', async (t) => {
  const h = await workspaceHarness(t)
  const order = {
    id: 'order-18', orderNumber: 18, client: 'Carla', customerIdentityType: 'registered_client',
    type: 'Entrega', status: 'Em preparo', paymentStatus: 'Pendente', orderDate: '2026-09-13',
    createdAt: '2026-09-13T12:00:00.000Z', subtotal: 30, total: 30,
    items: [{ id: 'item-18', productId: 'product-1', name: 'Marmita', quantity: 1, unitPrice: 30 }],
  }
  const capabilities = ['orders.view', 'orders.create', 'payments.receive', 'preferences.local']
  globalThis.fetch = async (path, request = {}) => {
    const url = String(path)
    if (url === '/api/auth/session') return response({ authenticated: true, businessId: 'business-1', settingsContextId: 'settings-1', capabilities })
    if (url === '/api/bootstrap') return response({
      tables: [], tableTabs: [], orders: [order], movements: [], clients: [], products: [], financeSettings: null,
      effectiveBusinessConfig: effective(options, 'cash'), effectiveConfigVersion: 'payment-v1',
    })
    if (url === '/api/printing/stations') return response({ stations: [] })
    if (url.startsWith('/api/printing/jobs?')) return response({ jobs: [] })
    if (url === '/api/orders' && (request.method || 'GET') === 'GET') return response({ orders: [order] })
    throw new Error(`Unexpected request: ${url}`)
  }
  const { default: App } = await h.load('/src/App.jsx')
  const screen = await h.render(App)
  await act(async () => buttonNamed(screen.root, 'Exibir detalhes').props.onClick())
  await act(async () => buttonNamed(screen.root, 'Registrar pagamento').props.onClick())
  assert.equal(nodeText(screen.root.findByProps({ role: 'combobox', 'aria-label': 'Forma de pagamento' })), 'Dinheiro')
})

test('App never exposes a Pix default while effective payment configuration is unavailable', async (t) => {
  const h = await workspaceHarness(t)
  const order = {
    id: 'order-19', orderNumber: 19, client: 'Davi', customerIdentityType: 'registered_client',
    type: 'Entrega', status: 'Em preparo', paymentStatus: 'Pendente', orderDate: '2026-09-13',
    createdAt: '2026-09-13T12:00:00.000Z', subtotal: 30, total: 30,
    items: [{ id: 'item-19', productId: 'product-1', name: 'Marmita', quantity: 1, unitPrice: 30 }],
  }
  const capabilities = ['orders.view', 'orders.create', 'payments.receive', 'preferences.local']
  globalThis.fetch = async (path, request = {}) => {
    const url = String(path)
    if (url === '/api/auth/session') return response({ authenticated: true, businessId: 'business-1', settingsContextId: 'settings-1', capabilities })
    if (url === '/api/bootstrap') return response({ tables: [], tableTabs: [], orders: [order], movements: [], clients: [], products: [], financeSettings: null })
    if (url.startsWith('/api/settings/effective')) return response({ message: 'unavailable' }, 503)
    if (url === '/api/printing/stations') return response({ stations: [] })
    if (url.startsWith('/api/printing/jobs?')) return response({ jobs: [] })
    if (url === '/api/orders' && (request.method || 'GET') === 'GET') return response({ orders: [order] })
    throw new Error(`Unexpected request: ${url}`)
  }
  const { default: App } = await h.load('/src/App.jsx')
  const screen = await h.render(App)
  await act(async () => buttonNamed(screen.root, 'Exibir detalhes').props.onClick())
  await act(async () => buttonNamed(screen.root, 'Registrar pagamento').props.onClick())
  assert.equal(nodeText(screen.root.findByProps({ role: 'combobox', 'aria-label': 'Forma de pagamento' })), 'Selecione')
  assert.equal(buttonNamed(screen.root, 'Confirmar pagamento').props.disabled, true)
})

test('movement keeps a persisted inactive method but blocks a newly inactive choice through review', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Dialog } = await h.load('/src/domains/finance/ui/MovementDialog.jsx')
  const movement = {
    id: 'movement-1', source: 'manual', type: 'saida', category: 'supplies', description: 'Compra',
    value: 25, movementDate: '2026-09-13', paymentMethod: 'Transferência',
  }
  const submissions = []
  const base = { open: true, movement, today: '2026-09-13', onClose() {}, onSubmit: (payload) => submissions.push(payload) }
  const historical = await h.render(Dialog, { ...base, paymentOptions: options })
  assert.equal(buttonNamed(historical.root, 'Revisar alterações').props.disabled, false)
  await act(async () => historical.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  await act(async () => buttonNamed(historical.root, 'Salvar alterações').props.onClick())
  assert.equal(submissions.length, 1, 'unchanged historical method remains retainable')

  const activeMovement = { ...movement, id: 'movement-2', paymentMethod: 'Pix' }
  const props = { ...base, movement: activeMovement, paymentOptions: options }
  const changing = await h.render(Dialog, props)
  await act(async () => changing.root.findByProps({ label: 'Forma ou meio' }).props.onChange('Dinheiro'))
  await act(async () => changing.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  await act(async () => changing.update(React.createElement(Dialog, { ...props, paymentOptions: [options[0]] })))
  assert.match(nodeText(changing.root), /não está mais ativa.*volte/i)
  assert.equal(buttonNamed(changing.root, 'Salvar alterações').props.disabled, true)
})
