import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDailySeries,
  calculatePeriodMetrics,
  filterOrdersByPeriod,
  getDashboardDateRange,
  getPaymentMix,
  getTopProducts,
} from './dashboardAnalytics.js'

const now = new Date(2026, 8, 2, 12, 0, 0)

const makeOrder = (overrides = {}) => ({
  id: overrides.id ?? crypto.randomUUID(),
  client: 'Cliente',
  orderDate: '2026-09-02',
  total: 0,
  paymentStatus: 'Pendente',
  paymentMethod: null,
  paidAmount: 0,
  items: [],
  ...overrides,
})

test('dashboard date ranges are inclusive and zero-padded in local time', () => {
  assert.deepEqual(getDashboardDateRange('today', now), ['2026-09-02'])
  assert.deepEqual(getDashboardDateRange('7d', now), [
    '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30',
    '2026-08-31', '2026-09-01', '2026-09-02',
  ])
  const thirty = getDashboardDateRange('30d', now)
  assert.equal(thirty.length, 30)
  assert.equal(thirty[0], '2026-08-04')
  assert.equal(thirty.at(-1), '2026-09-02')
})

test('period filtering and sales include paid and unpaid orders by order date', () => {
  const orders = [
    makeOrder({ id: 'today-paid', orderDate: '2026-09-02', total: 50, paymentStatus: 'Pago' }),
    makeOrder({ id: 'yesterday-pending', orderDate: '2026-09-01', total: 30 }),
    makeOrder({ id: 'week-paid', orderDate: '2026-08-28', total: 20, paymentStatus: 'Pago' }),
    makeOrder({ id: 'outside', orderDate: '2026-08-03', total: 999 }),
  ]

  assert.deepEqual(filterOrdersByPeriod(orders, '7d', now).map((order) => order.id), [
    'today-paid', 'yesterday-pending', 'week-paid',
  ])
  assert.deepEqual(calculatePeriodMetrics(orders, '7d', now), {
    sales: 100,
    orderCount: 3,
    averageTicket: 100 / 3,
  })
  assert.deepEqual(calculatePeriodMetrics([], '7d', now), {
    sales: 0,
    orderCount: 0,
    averageTicket: 0,
  })
})

test('daily series keeps every selected day and zero-fills missing dates', () => {
  const series = buildDailySeries([
    makeOrder({ orderDate: '2026-09-02', total: 50 }),
    makeOrder({ orderDate: '2026-09-02', total: 25 }),
    makeOrder({ orderDate: '2026-08-28', total: 20 }),
  ], '7d', now)

  assert.equal(series.length, 7)
  assert.deepEqual(series.find((row) => row.date === '2026-09-02'), {
    date: '2026-09-02', label: '02/09', sales: 75, orders: 2,
  })
  assert.deepEqual(series.find((row) => row.date === '2026-08-29'), {
    date: '2026-08-29', label: '29/08', sales: 0, orders: 0,
  })
})

test('top products aggregate repeated product identities, sum quantities, sort, and limit to five', () => {
  const orders = [makeOrder({
    orderDate: '2026-09-02',
    items: [
      { productId: 'p1', name: 'Marmita', size: 'P', quantity: 3 },
      { productId: 'p2', name: 'Marmita', size: 'M', quantity: 4 },
      { productId: 'p3', name: 'Suco', size: '500ml', quantity: 2 },
      { productId: 'p4', name: 'Sobremesa', size: 'Un', quantity: 1 },
      { productId: 'p5', name: 'Água', size: '500ml', quantity: 1 },
      { productId: 'p6', name: 'Café', size: 'Un', quantity: 1 },
    ],
  }), makeOrder({
    orderDate: '2026-09-01',
    items: [{ productId: 'p1', name: 'Marmita', size: 'P', quantity: 3 }],
  })]

  const top = getTopProducts(orders, '7d', now)
  assert.equal(top.length, 5)
  assert.deepEqual(top.slice(0, 3).map(({ label, quantity }) => ({ label, quantity })), [
    { label: 'Marmita P', quantity: 6 },
    { label: 'Marmita M', quantity: 4 },
    { label: 'Suco 500ml', quantity: 2 },
  ])
})

test('payment mix uses paid orders only, groups by method, and falls back to total', () => {
  const orders = [
    makeOrder({ orderDate: '2026-09-02', total: 50, paymentStatus: 'Pago', paymentMethod: 'Pix', paidAmount: 50, paidAt: '2026-08-20T12:00:00.000Z' }),
    makeOrder({ orderDate: '2026-09-01', total: 25, paymentStatus: 'Pago', paymentMethod: 'Pix', paidAmount: null }),
    makeOrder({ orderDate: '2026-08-28', total: 20, paymentStatus: 'Pago', paymentMethod: 'Dinheiro', paidAmount: 20 }),
    makeOrder({ orderDate: '2026-09-02', total: 40, paymentStatus: 'Pendente', paymentMethod: 'Pix' }),
    makeOrder({ orderDate: '2026-08-03', total: 80, paymentStatus: 'Pago', paymentMethod: 'Cartão de crédito', paidAmount: 80 }),
  ]

  assert.deepEqual(getPaymentMix(orders, '7d', now), [
    { method: 'Pix', amount: 75 },
    { method: 'Dinheiro', amount: 20 },
  ])
})
