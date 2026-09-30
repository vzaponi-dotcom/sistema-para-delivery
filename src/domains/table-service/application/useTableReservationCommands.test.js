import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useTableReservationCommands } from './useTableReservationCommands.js'

const mountProbe = async (props) => {
  let latest
  let renderer
  function Probe(currentProps) {
    latest = useTableReservationCommands(currentProps)
    return null
  }
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe, props))
  })
  return { getLatest: () => latest, unmount: () => renderer.unmount() }
}

const successResult = (suffix) => ({
  reservation: { id: 'reservation-1', revision: 4, status: suffix === 'arrival' ? 'converted' : 'reserved' },
  order: { id: 'order-1' },
  ...(suffix === 'arrival' ? { tableTab: { id: 'tab-1', status: 'open' } } : {}),
  tables: [{ id: 'table-1' }],
})

test('reservation commands use official responses and stable request ownership', async () => {
  const calls = []
  const effects = []
  const keys = []
  const messages = []
  const api = {
    updateReservation: async (...args) => { calls.push(['edit', ...args]); return successResult('edit') },
    confirmArrival: async (...args) => { calls.push(['arrival', ...args]); return successResult('arrival') },
    cancelReservation: async (...args) => { calls.push(['cancel', ...args]); return { ...successResult('cancel'), reservation: { id: 'reservation-1', status: 'cancelled' } } },
    markNoShow: async (...args) => { calls.push(['no-show', ...args]); return { ...successResult('no-show'), reservation: { id: 'reservation-1', status: 'no_show' } } },
  }
  const probe = await mountProbe({
    api,
    writesBlocked: false,
    canCreateOrders: true,
    canCancelOrders: true,
    canDiscountOrders: true,
    applyOfficialEffects: (result) => effects.push(result),
    refreshReservation: async () => assert.fail('unexpected refresh'),
    setRequestKey: (key) => keys.push(key),
    onSuccess: (message) => messages.push(message),
    onError: (error) => assert.fail(error?.message || 'unexpected error'),
  })

  await act(async () => {
    assert.equal(await probe.getLatest().editReservation('reservation-1', {
      expectedRevision: 3,
      adjustment: { type: 'discount' },
    }), true)
    assert.equal(await probe.getLatest().confirmArrival('reservation-1', 3, 'arrival-1'), true)
    assert.equal(await probe.getLatest().cancelReservation('reservation-1', { expectedRevision: 3, reason: 'other' }), true)
    assert.equal(await probe.getLatest().markNoShow('reservation-1', { expectedRevision: 3, reason: 'other' }), true)
  })

  assert.deepEqual(calls.map(([kind]) => kind), ['edit', 'arrival', 'cancel', 'no-show'])
  assert.equal(effects.length, 4)
  assert.deepEqual(keys, [
    'reservation:edit:reservation-1', null,
    'reservation:arrival:reservation-1', null,
    'reservation:cancel:reservation-1', null,
    'reservation:no-show:reservation-1', null,
  ])
  assert.deepEqual(messages, [
    'Reserva atualizada com sucesso',
    'Chegada confirmada e comanda aberta',
    'Reserva cancelada com sucesso',
    'Não comparecimento registrado',
  ])
  probe.unmount()
})

test('reservation commands block writes and enforce create/cancel/discount capabilities before API', async () => {
  let apiCalls = 0
  const api = {
    updateReservation: async () => { apiCalls += 1; return {} },
    confirmArrival: async () => { apiCalls += 1; return {} },
    cancelReservation: async () => { apiCalls += 1; return {} },
    markNoShow: async () => { apiCalls += 1; return {} },
  }
  const common = {
    api,
    applyOfficialEffects: () => {},
    refreshReservation: async () => {},
    setRequestKey: () => {},
    onSuccess: () => {},
    onError: () => {},
  }

  const blocked = await mountProbe({
    ...common,
    writesBlocked: true,
    canCreateOrders: true,
    canCancelOrders: true,
    canDiscountOrders: true,
  })
  await act(async () => {
    assert.equal(await blocked.getLatest().editReservation('r', { adjustment: { type: 'none' } }), false)
    assert.equal(await blocked.getLatest().confirmArrival('r', 1, 'm'), false)
    assert.equal(await blocked.getLatest().cancelReservation('r', {}), false)
    assert.equal(await blocked.getLatest().markNoShow('r', {}), false)
  })
  blocked.unmount()

  const denied = await mountProbe({
    ...common,
    writesBlocked: false,
    canCreateOrders: false,
    canCancelOrders: false,
    canDiscountOrders: false,
  })
  await act(async () => {
    assert.equal(await denied.getLatest().editReservation('r', { adjustment: { type: 'none' } }), false)
    assert.equal(await denied.getLatest().confirmArrival('r', 1, 'm'), false)
    assert.equal(await denied.getLatest().cancelReservation('r', {}), false)
    assert.equal(await denied.getLatest().markNoShow('r', {}), false)
  })
  denied.unmount()

  const discountDenied = await mountProbe({
    ...common,
    writesBlocked: false,
    canCreateOrders: true,
    canCancelOrders: true,
    canDiscountOrders: false,
  })
  await act(async () => {
    assert.equal(await discountDenied.getLatest().editReservation('r', { adjustment: { type: 'discount' } }), false)
  })
  discountDenied.unmount()

  assert.equal(apiCalls, 0)
})

test('reservation command conflict refreshes official detail once and never retries the mutation', async () => {
  const error = Object.assign(new Error('Reserva alterada'), { status: 409, code: 'TABLE_RESERVATION_CHANGED' })
  let apiCalls = 0
  let refreshCalls = 0
  const errors = []
  const probe = await mountProbe({
    api: {
      updateReservation: async () => { apiCalls += 1; throw error },
      confirmArrival: async () => ({}),
      cancelReservation: async () => ({}),
      markNoShow: async () => ({}),
    },
    writesBlocked: false,
    canCreateOrders: true,
    canCancelOrders: true,
    canDiscountOrders: true,
    applyOfficialEffects: () => assert.fail('conflict cannot apply effects'),
    refreshReservation: async () => { refreshCalls += 1 },
    setRequestKey: () => {},
    onSuccess: () => assert.fail('conflict cannot succeed'),
    onError: (caught) => errors.push(caught),
  })

  await act(async () => {
    assert.equal(await probe.getLatest().editReservation('reservation-1', {
      expectedRevision: 2,
      adjustment: { type: 'none' },
    }), false)
  })

  assert.equal(apiCalls, 1)
  assert.equal(refreshCalls, 1)
  assert.deepEqual(errors, [error])
  probe.unmount()
})


test('reservation command result observer receives the official arrival result after effects commit', async () => {
  const result = {
    reservation: { id: 'reservation-1', status: 'converted' },
    order: { id: 'order-1', tableTabId: 'tab-1' },
    tableTab: { id: 'tab-1', tableId: 'table-1', status: 'open' },
    tables: [{ id: 'table-1', occupancy: 'occupied', openTableTab: { id: 'tab-1' } }],
  }
  const events = []
  const probe = await mountProbe({
    api: {
      updateReservation: async () => ({}),
      confirmArrival: async () => result,
      cancelReservation: async () => ({}),
      markNoShow: async () => ({}),
    },
    writesBlocked: false,
    canCreateOrders: true,
    canCancelOrders: true,
    canDiscountOrders: true,
    applyOfficialEffects: () => events.push('effects'),
    refreshReservation: async () => {},
    setRequestKey: () => {},
    onSuccess: () => events.push('success'),
    onError: () => {},
    onResult: (official, action) => events.push([action, official]),
  })

  await act(async () => {
    assert.equal(await probe.getLatest().confirmArrival('reservation-1', 3, 'arrival-1'), true)
  })
  assert.deepEqual(events, ['effects', ['arrival', result], 'success'])
  probe.unmount()
})
