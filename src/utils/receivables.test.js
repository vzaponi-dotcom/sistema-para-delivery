import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPendingReceivableEntries,
  buildReceivablesForecast,
  calculateReceivableSummary,
  getDaysOverdue,
  getExpectedPaymentDate,
  getPaidReceivableOrders,
  getPendingReceivableOrders,
  getReceivableTiming,
  groupPendingOrders,
  sortReceivableEntries,
} from './receivables.js'

const order = (id, overrides = {}) => ({
  id,
  clientId: 'c1',
  client: 'Maria',
  customerIdentityType: 'registered_client',
  total: 20,
  paymentStatus: 'Pendente',
  status: 'Em preparo',
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

test('cancelled unpaid orders are not receivables', () => {
  const pending = getPendingReceivableOrders([
    order('valid', { total: 35 }),
    order('cancelled', { total: 70, status: 'Cancelado' }),
    order('paid', { total: 50, paymentStatus: 'Pago' }),
  ])

  assert.deepEqual(pending.map((item) => item.id), ['valid'])
  assert.equal(groupPendingOrders([order('cancelled', { total: 70, status: 'Cancelado' })]).length, 0)
})

const datedPending = (overrides = {}) => ({
  ...order('dated', {
    orderDate: '2026-09-06',
    createdAt: '2026-09-06T12:00:00.000Z',
    status: 'Finalizado',
    customerIdentityType: 'registered_client',
    items: [],
    ...overrides,
  }),
})

test('timing uses a payment promise over order date and separates paid and cancelled orders', () => {
  const paid = datedPending({ id: 'paid', paymentStatus: 'Pago', paidAt: '2026-09-06T14:00:00.000Z' })
  const cancelled = datedPending({ id: 'cancelled', status: 'Cancelado' })
  const promised = datedPending({ orderDate: '2026-09-01', promisedPaymentDate: '2026-09-11' })

  assert.equal(getExpectedPaymentDate(promised), '2026-09-11')
  assert.deepEqual(getReceivableTiming(promised, '2026-09-06'), {
    status: 'upcoming', expectedDate: '2026-09-11', daysOverdue: 0,
  })
  assert.equal(getReceivableTiming(promised, '2026-09-11').status, 'today')
  assert.equal(getReceivableTiming(promised, '2026-09-12').status, 'overdue')
  assert.equal(getDaysOverdue(datedPending({ orderDate: '2026-09-03' }), '2026-09-06'), 3)
  assert.equal(getReceivableTiming(paid, '2026-09-06').status, 'paid')
  assert.equal(getReceivableTiming(cancelled, '2026-09-06').status, 'excluded')
  assert.deepEqual(getPaidReceivableOrders([paid, cancelled]), [paid])
})

test('summary and forecast partition pending amounts by expected payment date', () => {
  const orders = [
    datedPending({ id: 'late', orderDate: '2026-09-03', total: 40 }),
    datedPending({ id: 'today', total: 50 }),
    datedPending({ id: 'tomorrow', promisedPaymentDate: '2026-09-07', total: 60 }),
    datedPending({ id: 'later', promisedPaymentDate: '2026-09-20', total: 70 }),
  ]
  assert.deepEqual(calculateReceivableSummary(orders, '2026-09-06'), {
    today: { amount: 50, count: 1 }, upcoming: { amount: 130, count: 2 }, overdue: { amount: 40, count: 1 },
  })
  const forecast = buildReceivablesForecast(orders, '2026-09-06', 7)
  assert.deepEqual(forecast.overdue, { amount: 40, count: 1 })
  assert.deepEqual(forecast.today, { amount: 50, count: 1 })
  assert.deepEqual(forecast.days[0], { date: '2026-09-07', amount: 60, count: 1 })
  assert.deepEqual(forecast.later, { amount: 70, count: 1 })
})

test('table tabs stay aggregated by newest pending order and urgency orders entries', () => {
  const entries = buildPendingReceivableEntries([
    datedPending({ id: 'tab-old', client: 'Mesa 04', clientId: null, customerIdentityType: 'table', tableTabId: 'tab-4', orderDate: '2026-09-04', total: 30 }),
    datedPending({ id: 'tab-new', client: 'Mesa 04', clientId: null, customerIdentityType: 'table', tableTabId: 'tab-4', orderDate: '2026-09-06', total: 40 }),
    datedPending({ id: 'late', orderDate: '2026-09-02' }),
    datedPending({ id: 'future', promisedPaymentDate: '2026-09-08' }),
  ], [{ id: 'tab-4', tableIdentifier: '04', status: 'open' }], '2026-09-06')
  const table = entries.find((entry) => entry.kind === 'table_tab')
  assert.equal(table.label, 'Mesa 04')
  assert.equal(table.total, 70)
  assert.equal(table.expectedDate, '2026-09-06')
  assert.equal(table.timing.status, 'today')
  assert.deepEqual(sortReceivableEntries(entries, 'urgency').map((entry) => entry.key), [
    'order:late', 'table-tab:tab-4', 'order:future',
  ])
})

test('table tab labels do not duplicate the Mesa prefix from registered identifiers', () => {
  const entries = buildPendingReceivableEntries([
    datedPending({
      id: 'tab-registered-name',
      client: 'Mesa 1',
      clientId: null,
      customerIdentityType: 'table',
      tableTabId: 'tab-registered-name',
    }),
  ], [{ id: 'tab-registered-name', tableIdentifier: 'Mesa 1', status: 'open' }], '2026-09-06')

  assert.equal(entries[0].label, 'Mesa 1')
})

test('an open table tab is counted once in today summary and forecast using its newest pending order', () => {
  const tableOrders = [
    datedPending({ id: 'tab-old', client: 'Mesa 04', clientId: null, customerIdentityType: 'table', tableTabId: 'tab-4', orderDate: '2026-09-03', total: 30 }),
    datedPending({ id: 'tab-today', client: 'Mesa 04', clientId: null, customerIdentityType: 'table', tableTabId: 'tab-4', orderDate: '2026-09-06', total: 40 }),
  ]
  assert.deepEqual(calculateReceivableSummary(tableOrders, '2026-09-06'), {
    today: { amount: 70, count: 1 }, upcoming: { amount: 0, count: 0 }, overdue: { amount: 0, count: 0 },
  })
  const forecast = buildReceivablesForecast(tableOrders, '2026-09-06', 7)
  assert.deepEqual(forecast.today, { amount: 70, count: 1 })
  assert.deepEqual(forecast.overdue, { amount: 0, count: 0 })
})
