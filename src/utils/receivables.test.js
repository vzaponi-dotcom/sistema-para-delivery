import test from 'node:test'
import assert from 'node:assert/strict'
import { groupPendingOrders } from './receivables.js'

const order = (id, overrides = {}) => ({
  id,
  clientId: 'c1',
  client: 'Maria',
  customerIdentityType: 'registered_client',
  total: 20,
  paymentStatus: 'Pendente',
  ...overrides,
})

test('registered client pending orders group by client id', () => {
  const groups = groupPendingOrders([
    order('o1', { total: 20 }),
    order('o2', { total: 30 }),
  ])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].label, 'Maria')
  assert.equal(groups[0].orders.length, 2)
  assert.equal(groups[0].total, 50)
})

test('guest names and legacy tables stay order-scoped even when labels repeat', () => {
  const groups = groupPendingOrders([
    order('o1', { clientId: null, client: 'João', customerIdentityType: 'guest_name' }),
    order('o2', { clientId: null, client: 'João', customerIdentityType: 'guest_name' }),
    order('o3', { clientId: null, client: 'Mesa 04', customerIdentityType: 'table', tableTabId: null }),
    order('o4', { clientId: null, client: 'Mesa 04', customerIdentityType: 'table', tableTabId: null }),
  ])
  assert.equal(groups.length, 4)
  assert.deepEqual(groups.map((group) => group.orders.length), [1, 1, 1, 1])
})

test('table orders group only when they share the same table tab id', () => {
  const groups = groupPendingOrders([
    order('o1', { clientId: null, client: 'Mesa 04', customerIdentityType: 'table', tableTabId: 'tab-1', total: 20 }),
    order('o2', { clientId: null, client: 'Mesa 04', customerIdentityType: 'table', tableTabId: 'tab-1', total: 30 }),
    order('o3', { clientId: null, client: 'Mesa 04', customerIdentityType: 'table', tableTabId: null, total: 10 }),
  ])
  assert.equal(groups.length, 2)
  const tab = groups.find((group) => group.tableTabId === 'tab-1')
  assert.equal(tab.kind, 'table_tab')
  assert.equal(tab.orders.length, 2)
  assert.equal(tab.total, 50)
})
