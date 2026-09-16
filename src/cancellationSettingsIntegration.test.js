import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'

import { buttonNamed, nodeText, renderWithNavigation, workspaceHarness } from './test-support/renderWorkspace.js'
import { buildSettingsConflict } from './app/settingsConflict.js'

const activeReasons = [
  { id: 'client_changed_mind', label: 'Cliente desistiu', requiresNote: false },
  { id: 'weather-delay', label: 'Chuva forte', requiresNote: false },
  { id: 'other', label: 'Outro', requiresNote: true },
]

const effective = (items = activeReasons, revision = 7) => ({
  version: 'cancel-v7', revisions: { cancellationReasons: revision },
  cancellationReasons: { items },
})

const order = { id: 'order-1', orderNumber: 1, client: 'Ana', paymentStatus: 'Pendente' }

test('new cancellation choices come only from the active effective projection', async () => {
  const { cancellationOptionsFromEffective, cancellationRevisionFromEffective } = await import('./utils/cancellationReasonOptions.js')
  assert.deepEqual(cancellationOptionsFromEffective(effective()), [
    { value: 'client_changed_mind', label: 'Cliente desistiu', id: 'client_changed_mind', requiresNote: false },
    { value: 'weather-delay', label: 'Chuva forte', id: 'weather-delay', requiresNote: false },
    { value: 'other', label: 'Outro', id: 'other', requiresNote: true },
  ])
  assert.equal(cancellationRevisionFromEffective(effective()), 7)
  assert.equal(cancellationRevisionFromEffective(effective(activeReasons, 0)), 0)
  assert.deepEqual(cancellationOptionsFromEffective(null), [])
  assert.equal(cancellationRevisionFromEffective(null), null)
})

test('legitimate revision-zero defaults remain confirmed choices for a new business', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Dialog } = await h.load('/src/components/CancelOrderDialog.jsx')
  const confirmations = []
  const screen = await h.render(Dialog, {
    open: true, order, reasonOptions: activeReasons.map((item) => ({ ...item, value: item.id })),
    reasonRevision: 0, paymentOptions: [], onClose() {}, onConfirm: (payload) => confirmations.push(payload),
  })
  const select = screen.root.findByProps({ role: 'combobox', 'aria-label': 'Motivo do cancelamento' })
  await act(async () => select.props.onClick())
  await act(async () => buttonNamed(screen.root, 'Cliente desistiu').props.onClick())
  await act(async () => screen.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  await act(async () => buttonNamed(screen.root, 'Confirmar cancelamento definitivamente').props.onClick())
  assert.equal(confirmations[0].expectedRevision, 0)
})

test('dialog uses supplied reasons and revision, without a fixed fallback', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Dialog } = await h.load('/src/components/CancelOrderDialog.jsx')
  const confirmations = []
  const screen = await h.render(Dialog, {
    open: true, order, reasonOptions: [{ value: 'weather-delay', label: 'Chuva forte', id: 'weather-delay', requiresNote: false }],
    reasonRevision: 7, paymentOptions: [], onClose() {}, onConfirm: (payload) => confirmations.push(payload),
  })
  const select = screen.root.findByProps({ role: 'combobox', 'aria-label': 'Motivo do cancelamento' })
  await act(async () => select.props.onClick())
  assert.ok(buttonNamed(screen.root, 'Chuva forte'))
  assert.equal(buttonNamed(screen.root, 'Cliente desistiu'), undefined)
  await act(async () => buttonNamed(screen.root, 'Chuva forte').props.onClick())
  await act(async () => screen.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  await act(async () => buttonNamed(screen.root, 'Confirmar cancelamento definitivamente').props.onClick())
  assert.deepEqual(confirmations, [{ reason: 'weather-delay', note: '', expectedRevision: 7, refundNow: false, refundMethod: '' }])
})

test('unavailable effective cancellation settings expose no invented choices and block submission', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Dialog } = await h.load('/src/components/CancelOrderDialog.jsx')
  const confirmations = []
  const screen = await h.render(Dialog, {
    open: true, order, reasonOptions: [], reasonRevision: null, paymentOptions: [], onClose() {}, onConfirm: (payload) => confirmations.push(payload),
  })
  assert.match(nodeText(screen.root), /motivos de cancelamento.*indisponíveis/i)
  assert.equal(buttonNamed(screen.root, 'Revisar cancelamento').props.disabled, true)
  const select = screen.root.findByProps({ role: 'combobox', 'aria-label': 'Motivo do cancelamento' })
  await act(async () => select.props.onClick())
  assert.equal(buttonNamed(screen.root, 'Cliente desistiu'), undefined)
  assert.deepEqual(confirmations, [])
})

test('requiresNote is enforced from effective metadata and note length is limited to 240', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Dialog } = await h.load('/src/components/CancelOrderDialog.jsx')
  const props = { open: true, order, reasonOptions: activeReasons.map((item) => ({ ...item, value: item.id })), reasonRevision: 7, paymentOptions: [], onClose() {}, onConfirm() {} }
  const screen = await h.render(Dialog, props)
  const select = screen.root.findByProps({ role: 'combobox', 'aria-label': 'Motivo do cancelamento' })
  await act(async () => select.props.onClick())
  await act(async () => buttonNamed(screen.root, 'Outro').props.onClick())
  await act(async () => screen.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.match(nodeText(screen.root.findByProps({ role: 'alert' })), /Descreva o motivo/)
  const textarea = screen.root.findByType('textarea')
  assert.equal(textarea.props.maxLength, 240)
  await act(async () => textarea.props.onChange({ target: { value: 'x'.repeat(241) } }))
  await act(async () => screen.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.match(nodeText(screen.root.findByProps({ role: 'alert' })), /no máximo 240/)
})

test('historical inactive reason remains readable from the order snapshot label', async (t) => {
  const h = await workspaceHarness(t)
  const { default: OrderHistory } = await h.load('/src/pages/OrderHistory.jsx')
  const historical = {
    ...order, status: 'Cancelado', cancelReason: 'weather-delay', cancelReasonLabel: 'Chuva forte',
    cancelReasonNote: '', cancelledAt: '2026-09-13T12:00:00.000Z', createdAt: '2026-09-13T11:00:00.000Z',
    type: 'Entrega', orderDate: '2026-09-13', total: 25, items: [], paymentStatus: 'Pendente',
  }
  const screen = await renderWithNavigation(h, OrderHistory, {
    orders: [historical], queryState: { filter: 'all', analysisPeriod: 'today' }, onQueryChange() {},
    granted: new Set(), implemented: new Set(['history']), onNavigate() {}, canCancelOrders: false,
  })
  assert.match(nodeText(screen.root), /Motivo: Chuva forte/)
  assert.doesNotMatch(nodeText(screen.root), /Motivo: weather-delay/)
})

test('cancelled order detail uses the historical label resolved by the worker', async (t) => {
  const h = await workspaceHarness(t)
  const { default: OrderDetail } = await h.load('/src/components/OrderDetail.jsx')
  const cancelled = {
    ...order, status: 'Cancelado', cancelReason: 'weather-delay', cancelReasonLabel: 'Chuva forte',
    cancelReasonNote: 'Ruas alagadas', cancelledAt: '2026-09-13T12:00:00.000Z',
    createdAt: '2026-09-13T11:00:00.000Z', orderDate: '2026-09-13', type: 'Entrega', total: 25, items: [],
  }
  const screen = await h.render(OrderDetail, {
    order: cancelled, currency: (value) => `R$ ${value}`, onClose() {}, canCancelOrders: false,
  })
  assert.match(nodeText(screen.root), /Motivo do cancelamento.*Chuva forte.*Ruas alagadas/s)
  assert.doesNotMatch(nodeText(screen.root), /weather-delay/)
})

test('first-use conflict preserves rename intent for explicit review instead of silently applying it', () => {
  const data = { items: [{ id: 'weather-delay', label: 'Chuva', active: true, sortOrder: 0 }] }
  const base = { revision: 1, data, meta: { items: { 'weather-delay': { isSystem: false, usedEver: false, canRename: true, canDelete: true } } } }
  const draft = { items: [{ ...data.items[0], label: 'Chuva forte' }] }
  const current = { revision: 2, data, meta: { items: { 'weather-delay': { isSystem: false, usedEver: true, canRename: false, canDelete: false } } } }
  const review = buildSettingsConflict({ base, draft, current })
  const protectedRename = review.conflicts.find((entry) => entry.kind === 'protected-action')
  assert.ok(protectedRename)
  assert.equal(protectedRename.draft, 'Chuva forte')
  assert.deepEqual(protectedRename.choices, ['current'])
  assert.match(protectedRename.message, /primeiro uso|passou a ser usado/i)
})

test('refund payment validation remains independent from cancellation reason selection', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Dialog } = await h.load('/src/components/CancelOrderDialog.jsx')
  const paid = { ...order, paymentStatus: 'Pago', paymentMethod: 'Transferência' }
  const screen = await h.render(Dialog, {
    open: true, order: paid, reasonOptions: activeReasons.map((item) => ({ ...item, value: item.id })), reasonRevision: 7,
    paymentOptions: [{ value: 'Pix', label: 'Pix', code: 'pix' }], onClose() {}, onConfirm() {},
  })
  await act(async () => buttonNamed(screen.root, 'Sim').props.onClick())
  assert.match(nodeText(screen.root), /método original.*inativo/i)
  assert.equal(buttonNamed(screen.root, 'Revisar cancelamento').props.disabled, true)
})
