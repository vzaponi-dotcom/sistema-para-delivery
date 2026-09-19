import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useTableTabPaymentWorkflow } from './useTableTabPaymentWorkflow.js'

const paidResult = () => ({
  orders: [{ id: 'o1', paymentStatus: 'Pago' }],
  movements: [{ id: 'm1' }],
  tableTab: { id: 'tab-1', tableIdentifier: '7', status: 'closed' },
  tables: [{ id: 'table-1', occupancy: 'free', openTableTab: null }],
})

const settledReceipt = () => ({
  applied: ['orders', 'movements', 'tableTabs', 'tables'],
  data: {
    orders: [{ id: 'o1', paymentStatus: 'Pago' }],
    movements: [{ id: 'm1' }],
    tableTabs: [{ id: 'tab-1', status: 'closed' }],
    tables: [{ id: 'table-1', occupancy: 'free', openTableTab: null }],
  },
})

const staleReceipt = () => ({
  applied: ['orders', 'movements', 'tableTabs', 'tables'],
  data: {
    orders: [{ id: 'o1', paymentStatus: 'Pendente' }],
    movements: [],
    tableTabs: [{ id: 'tab-1', status: 'open' }],
    tables: [{ id: 'table-1', occupancy: 'occupied', openTableTab: { id: 'tab-1' } }],
  },
})

const intent = {
  tableId: 'table-1',
  tableTabId: 'tab-1',
  selectionGeneration: 4,
}

async function mountWorkflow(overrides = {}) {
  let latest
  let renderer
  const keys = []
  const successes = []
  const errors = []
  const cleared = []
  let guard = 1
  let revision = 10
  let refreshCalls = 0

  const props = {
    api: { registerTableTabPayment: async () => paidResult() },
    writesBlocked: false,
    getOfficialTables: () => [{ id: 'table-1', isActive: true, occupancy: 'occupied', openTableTab: { id: 'tab-1' } }],
    ownsSelection: (owner, tables) => owner.selectionGeneration === 4
      && owner.tableId === 'table-1'
      && owner.tableTabId === 'tab-1'
      && (!tables || tables.some((table) => table.id === 'table-1')),
    clearSelection: () => { cleared.push(true); return true },
    getSyncGuard: () => guard,
    getOfficialRevision: () => revision,
    applyOfficialEffects: () => settledReceipt(),
    refreshOfficialData: async () => { refreshCalls += 1; return settledReceipt() },
    setRequestKey: (value) => keys.push(value),
    onSuccess: (message) => successes.push(message),
    onError: (error) => errors.push(error),
    ...overrides,
  }

  function Probe(currentProps) {
    latest = useTableTabPaymentWorkflow(currentProps)
    return null
  }

  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe, props))
  })

  return {
    getLatest: () => latest,
    keys,
    successes,
    errors,
    cleared,
    getRefreshCalls: () => refreshCalls,
    setGuard: (value) => { guard = value },
    setRevision: (value) => { revision = value },
    unmount: () => renderer.unmount(),
  }
}

test('accepted table-tab payment applies official effects and settles immediately when authority is complete', async () => {
  const applied = []
  const probe = await mountWorkflow({
    applyOfficialEffects: (effect) => {
      applied.push(effect)
      return settledReceipt()
    },
  })

  await act(async () => {
    assert.equal(await probe.getLatest().pay('tab-1', 'Pix', intent), true)
  })

  assert.deepEqual(applied, [{
    orders: paidResult().orders,
    movements: paidResult().movements,
    tableTab: paidResult().tableTab,
    tables: paidResult().tables,
  }])
  assert.equal(probe.getLatest().syncState, null)
  assert.equal(probe.cleared.length, 1)
  assert.deepEqual(probe.successes, ['Pagamento de Mesa 7 recebido via Pix'])
  probe.unmount()
})

test('reconciliation performs a mandatory second read when the first cannot prove settlement', async () => {
  const receipts = [staleReceipt(), settledReceipt()]
  const probe = await mountWorkflow({
    getOfficialRevision: () => 11,
    refreshOfficialData: async () => receipts.shift(),
  })

  await act(async () => {
    assert.equal(await probe.getLatest().pay('tab-1', 'Pix', intent), true)
  })

  assert.equal(receipts.length, 0)
  assert.equal(probe.getLatest().syncState, null)
  assert.equal(probe.cleared.length, 1)
  probe.unmount()
})

test('failed two-read reconciliation exposes retry without charging again', async () => {
  let paymentCalls = 0
  const refreshReceipts = [staleReceipt(), staleReceipt(), settledReceipt()]
  const probe = await mountWorkflow({
    api: {
      registerTableTabPayment: async () => {
        paymentCalls += 1
        return paidResult()
      },
    },
    getOfficialRevision: () => 11,
    refreshOfficialData: async () => refreshReceipts.shift() || settledReceipt(),
  })

  await act(async () => {
    assert.equal(await probe.getLatest().pay('tab-1', 'Pix', intent), true)
  })

  assert.equal(paymentCalls, 1)
  assert.deepEqual(probe.getLatest().syncState, {
    status: 'error',
    tableId: 'table-1',
    tabId: 'tab-1',
  })

  await act(async () => {
    assert.equal(await probe.getLatest().retrySync(), true)
  })

  assert.equal(paymentCalls, 1)
  assert.equal(probe.getLatest().syncState, null)
  probe.unmount()
})

test('stale session ignores accepted response and never applies or reconciles it', async () => {
  let resolvePayment
  const pending = new Promise((resolve) => { resolvePayment = resolve })
  let applied = 0
  const probe = await mountWorkflow({
    api: { registerTableTabPayment: () => pending },
    applyOfficialEffects: () => { applied += 1; return settledReceipt() },
  })

  let payment
  await act(async () => {
    payment = probe.getLatest().pay('tab-1', 'Pix', intent)
  })
  probe.setGuard(2)
  await act(async () => {
    resolvePayment(paidResult())
    assert.equal(await payment, false)
  })

  assert.equal(applied, 0)
  assert.equal(probe.getLatest().syncState, null)
  probe.unmount()
})
