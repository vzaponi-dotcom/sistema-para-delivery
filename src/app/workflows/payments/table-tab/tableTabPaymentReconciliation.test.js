import test from 'node:test'
import assert from 'node:assert/strict'
import { settleTableTabPayment } from './tableTabPaymentReconciliation.js'

const owner = () => ({
  tabId: 'tab-1',
  tableId: 'table-1',
  result: {
    orders: [{ id: 'o1' }],
    movements: [{ id: 'm1' }],
  },
})

const receipt = (overrides = {}) => ({
  applied: ['orders', 'movements', 'tableTabs', 'tables'],
  data: {
    orders: [{ id: 'o1', paymentStatus: 'Pago' }],
    movements: [{ id: 'm1' }],
    tableTabs: [{ id: 'tab-1', status: 'closed' }],
    tables: [{ id: 'table-1', occupancy: 'free', openTableTab: null }],
    ...overrides,
  },
})

test('settlement requires all payment collections and authoritative closed tab', () => {
  const current = receipt()
  assert.deepEqual(settleTableTabPayment(owner(), current), {
    settled: true,
    nextTables: current.data.tables,
    replaced: false,
  })
})

test('missing payment collection cannot settle', () => {
  const current = receipt()
  current.applied = ['orders', 'movements', 'tables']
  assert.deepEqual(settleTableTabPayment(owner(), current), { settled: false })
})

test('stale unpaid order cannot settle', () => {
  assert.deepEqual(settleTableTabPayment(owner(), receipt({
    orders: [{ id: 'o1', paymentStatus: 'Pendente' }],
  })), { settled: false })
})

test('missing accepted movement cannot settle', () => {
  assert.deepEqual(settleTableTabPayment(owner(), receipt({ movements: [] })), { settled: false })
})

test('old table tab still open cannot settle', () => {
  assert.deepEqual(settleTableTabPayment(owner(), receipt({
    tableTabs: [{ id: 'tab-1', status: 'open' }],
  })), { settled: false })
})

test('table reoccupied by a different tab settles without claiming the replacement selection', () => {
  const current = receipt({
    tables: [{
      id: 'table-1',
      occupancy: 'occupied',
      openTableTab: { id: 'tab-2' },
    }],
  })
  assert.deepEqual(settleTableTabPayment(owner(), current), {
    settled: true,
    nextTables: current.data.tables,
    replaced: true,
  })
})
