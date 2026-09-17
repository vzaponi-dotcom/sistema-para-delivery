import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useOrderCommands } from './useOrderCommands.js'

const orders = [
  { id: 'o-1', type: 'Entrega', status: 'Em preparo' },
  { id: 'o-2', type: 'Retirada', status: 'Em preparo' },
]

const mountProbe = async (props) => {
  let latest
  let renderer
  function Probe(currentProps) {
    latest = useOrderCommands(currentProps)
    return null
  }
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe, props))
  })
  return { getLatest: () => latest, unmount: () => renderer.unmount() }
}

test('finalize and refundable cancellation commit official effects with current success copy', async () => {
  const commits = []
  const messages = []
  const api = {
    updateOrderStatus: async (id, status) => ({ order: { id, status } }),
    cancelOrder: async (id) => ({
      order: { id, status: 'Cancelado' },
      movement: { id: 'm-1', type: 'saida' },
      tableTab: { id: 'tab-1', status: 'open' },
    }),
  }
  const probe = await mountProbe({
    orders,
    api,
    canFinalizeOrders: true,
    canCancelOrders: true,
    canRefundPayments: true,
    writesBlocked: false,
    applyOfficialEffects: (effects) => commits.push(effects),
    onSuccess: (message) => messages.push(message),
    onError: () => {},
  })

  await act(async () => { assert.equal(await probe.getLatest().finalizeOrder('o-1'), true) })
  assert.deepEqual(commits[0], { order: { id: 'o-1', status: 'Finalizado' } })
  assert.equal(messages[0], 'Pedido saiu para entrega')

  await act(async () => { assert.equal(await probe.getLatest().cancelOrder('o-2', { refundNow: true }), true) })
  assert.deepEqual(commits[1], {
    order: { id: 'o-2', status: 'Cancelado' },
    movement: { id: 'm-1', type: 'saida' },
    tableTab: { id: 'tab-1', status: 'open' },
  })
  assert.equal(messages[1], 'Pedido cancelado e estorno registrado')
  probe.unmount()
})

test('refund cancellation is rejected without refund permission', async () => {
  let cancelCalls = 0
  const probe = await mountProbe({
    orders,
    api: {
      updateOrderStatus: async () => ({}),
      cancelOrder: async () => { cancelCalls += 1; return {} },
    },
    canFinalizeOrders: true,
    canCancelOrders: true,
    canRefundPayments: false,
    writesBlocked: false,
    applyOfficialEffects: () => {},
    onSuccess: () => {},
    onError: () => {},
  })

  await act(async () => {
    assert.equal(await probe.getLatest().cancelOrder('o-2', { refundNow: true }), false)
  })
  assert.equal(cancelCalls, 0)
  probe.unmount()
})
