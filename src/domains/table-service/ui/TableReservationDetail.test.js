import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness, nodeText, buttonNamed } from '../../../test-support/renderWorkspace.js'

const detail = {
  reservation: {
    id: 'reservation-1',
    orderId: 'order-1',
    orderNumber: 81,
    tableId: 'table-3',
    tableName: 'Mesa 3',
    status: 'reserved',
    scheduledFor: '2026-10-10T23:00:00.000Z',
    endsAt: '2026-10-11T01:00:00.000Z',
    durationMinutes: 120,
    revision: 7,
    clientId: 'client-2',
    clientName: 'Maria',
    itemCount: 3,
    totalCents: 5900,
    orderStatus: 'Em preparo',
  },
  order: {
    id: 'order-1',
    orderNumber: 81,
    clientId: 'client-2',
    client: 'Mesa 3 · Maria',
    type: 'Local',
    status: 'Em preparo',
    orderDate: '2026-10-10',
    scheduledFor: '2026-10-10T23:00:00.000Z',
    createdAt: '2026-10-10T18:00:00.000Z',
    subtotal: 64,
    deliveryFee: 0,
    adjustment: { type: 'discount', mode: 'fixed', value: 5, amount: 5, reason: 'Cortesia' },
    total: 59,
    items: [
      { id: 'i1', productId: 'p1', name: 'Marmita', size: 'G', quantity: 2, unitPrice: 32, note: 'sem cebola' },
      { id: 'i2', productId: 'p2', name: 'Suco', size: 'Un', quantity: 1, unitPrice: 0, note: '' },
    ],
  },
  printJob: { id: 'job-1', availableAt: '2026-10-10T22:10:00.000Z' },
  hasManualPrintHistory: false,
}

const currency = (value) => `R$ ${Number(value).toFixed(2)}`

test('reservation detail shows semantic reservation identity, service time, items and total without an open-comanda bypass', async (t) => {
  const h = await workspaceHarness(t)
  const { default: TableReservationDetail } = await h.load('/src/domains/table-service/ui/TableReservationDetail.jsx')
  const renderer = await h.render(TableReservationDetail, {
    detail,
    currency,
    now: new Date('2026-10-10T21:00:00.000Z'),
    currentTiming: { scheduledPrepLeadMinutes: 50, scheduledLateGraceMinutes: 15, immediateLateAfterMinutes: 30, immediateVeryLateAfterMinutes: 40 },
    canCreateOrders: true,
    canCancelOrders: true,
    cancellationOptions: [{ value: 'client_changed_mind', label: 'Cliente desistiu', requiresNote: false }],
    cancellationRevision: 4,
  })

  const text = nodeText(renderer.root)
  assert.match(text, /RESERVA.*Mesa 3.*Reservada/i)
  assert.match(text, /Maria/)
  assert.match(text, /10\/10\/2026/)
  assert.match(text, /20:00/)
  assert.match(text, /3 itens/)
  assert.match(text, /2x.*Marmita.*sem cebola/i)
  assert.match(text, /Total previsto.*R\$ 59.00/i)
  assert.ok(buttonNamed(renderer.root, 'Editar reserva'))
  assert.ok(buttonNamed(renderer.root, 'Confirmar chegada'))
  assert.ok(buttonNamed(renderer.root, 'Cancelar reserva'))
  assert.ok(buttonNamed(renderer.root, 'Não compareceu'))
  assert.equal(buttonNamed(renderer.root, 'Abrir comanda'), undefined)
})

test('reservation actions obey edit window, scheduled day and capabilities', async (t) => {
  const h = await workspaceHarness(t)
  const { default: TableReservationDetail } = await h.load('/src/domains/table-service/ui/TableReservationDetail.jsx')

  const beforeDay = await h.render(TableReservationDetail, {
    detail,
    currency,
    now: new Date('2026-10-09T21:00:00.000Z'),
    currentTiming: { scheduledPrepLeadMinutes: 50, scheduledLateGraceMinutes: 15, immediateLateAfterMinutes: 30, immediateVeryLateAfterMinutes: 40 },
    canCreateOrders: true,
    canCancelOrders: false,
  })
  assert.equal(buttonNamed(beforeDay.root, 'Editar reserva').props.disabled, false)
  assert.equal(buttonNamed(beforeDay.root, 'Confirmar chegada').props.disabled, true)
  assert.equal(buttonNamed(beforeDay.root, 'Cancelar reserva'), undefined)
  assert.equal(buttonNamed(beforeDay.root, 'Não compareceu'), undefined)

  const inWindow = await h.render(TableReservationDetail, {
    detail,
    currency,
    now: new Date('2026-10-10T22:11:00.000Z'),
    currentTiming: { scheduledPrepLeadMinutes: 50, scheduledLateGraceMinutes: 15, immediateLateAfterMinutes: 30, immediateVeryLateAfterMinutes: 40 },
    canCreateOrders: true,
    canCancelOrders: true,
  })
  assert.equal(buttonNamed(inWindow.root, 'Editar reserva').props.disabled, true)
  assert.equal(buttonNamed(inWindow.root, 'Confirmar chegada').props.disabled, false)
})

test('arrival confirmation is explicit and cancel/no-show require an active configured reason', async (t) => {
  const h = await workspaceHarness(t)
  const { default: TableReservationDetail } = await h.load('/src/domains/table-service/ui/TableReservationDetail.jsx')
  const arrivals = []
  const cancellations = []
  const noShows = []
  const renderer = await h.render(TableReservationDetail, {
    detail,
    currency,
    now: new Date('2026-10-10T21:00:00.000Z'),
    currentTiming: { scheduledPrepLeadMinutes: 50, scheduledLateGraceMinutes: 15, immediateLateAfterMinutes: 30, immediateVeryLateAfterMinutes: 40 },
    canCreateOrders: true,
    canCancelOrders: true,
    cancellationOptions: [
      { value: 'client_changed_mind', label: 'Cliente desistiu', requiresNote: false },
      { value: 'other', label: 'Outro', requiresNote: true },
    ],
    cancellationRevision: 4,
    onConfirmArrival: (...args) => arrivals.push(args),
    onCancel: (...args) => cancellations.push(args),
    onNoShow: (...args) => noShows.push(args),
  })

  await act(async () => buttonNamed(renderer.root, 'Confirmar chegada').props.onClick())
  assert.match(nodeText(renderer.root), /Confirmar chegada.*Mesa 3/i)
  await act(async () => buttonNamed(renderer.root, 'Confirmar chegada e abrir comanda').props.onClick())
  assert.deepEqual(arrivals, [['reservation-1', 7]])

  await act(async () => buttonNamed(renderer.root, 'Cancelar reserva').props.onClick())
  const cancelDialog = renderer.root.findByProps({ role: 'dialog' })
  assert.match(nodeText(cancelDialog), /Cancelar reserva/)
  const cancelSelect = cancelDialog.findByProps({ role: 'combobox', 'aria-label': 'Motivo' })
  await act(async () => cancelSelect.props.onClick())
  const cancelOption = cancelDialog.findAllByProps({ role: 'option' }).find((option) => nodeText(option).includes('Cliente desistiu'))
  await act(async () => cancelOption.props.onClick())
  await act(async () => buttonNamed(cancelDialog, 'Confirmar cancelamento').props.onClick())
  assert.deepEqual(cancellations, [['reservation-1', {
    expectedRevision: 7,
    reason: 'client_changed_mind',
    note: '',
    cancelReasonRevision: 4,
    refundNow: false,
  }]])

  await act(async () => buttonNamed(renderer.root, 'Não compareceu').props.onClick())
  const noShowDialog = renderer.root.findByProps({ role: 'dialog' })
  const noShowSelect = noShowDialog.findByProps({ role: 'combobox', 'aria-label': 'Motivo' })
  await act(async () => noShowSelect.props.onClick())
  const noShowOption = noShowDialog.findAllByProps({ role: 'option' }).find((option) => nodeText(option).includes('Cliente desistiu'))
  await act(async () => noShowOption.props.onClick())
  await act(async () => buttonNamed(noShowDialog, 'Registrar não comparecimento').props.onClick())
  assert.deepEqual(noShows, [['reservation-1', {
    expectedRevision: 7,
    reason: 'client_changed_mind',
    note: '',
    cancelReasonRevision: 4,
    refundNow: false,
  }]])
})
