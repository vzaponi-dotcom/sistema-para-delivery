import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildDailySeries, calculatePeriodMetrics, getPaymentMix, getTopProducts } from '../utils/dashboardAnalytics.js'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('dashboard keeps the approved financial summary and 30-day commercial period', () => {
  const page = source('./Dashboard.jsx')
  const query = source('../app/queryContext.js')
  assert.match(query, /dashboard: \{ period: '30d', valuesVisible: true \}/)
  for (const label of ['Vendas hoje', 'Recebido hoje', 'A receber', 'Vendas no período', 'Pedidos no período', 'Ticket médio']) assert.match(page, new RegExp(label))
  assert.match(page, /DashboardPeriodSelector/)
  assert.doesNotMatch(page, /Pedidos ativos/)
})

test('dashboard renders all four approved commercial visualizations', () => {
  const page = source('./Dashboard.jsx')
  for (const label of ['Vendas por dia', 'Pedidos por dia', 'Top 5 produtos', 'Formas de pagamento']) assert.match(page, new RegExp(label))
  assert.match(page, /DashboardLineChart/)
  assert.match(page, /DashboardBarChart/)
  assert.match(page, /DashboardPaymentMix/)
})

test('dashboard leaves operational timing and recent orders to history', () => {
  const page = source('./Dashboard.jsx')
  const analysis = source('../components/OperationalHistoryAnalysis.jsx')
  assert.doesNotMatch(page, /calculateOperationalMetrics|Tempo operacional|Pedidos recentes/)
  assert.match(analysis, /calculateOperationalMetrics/)
  assert.match(analysis, /Tempo operacional/)
  assert.match(analysis, /Por faixa de tempo/)
  assert.match(analysis, /Por tipo de atendimento/)
})

test('one global eye control masks dashboard money without persistence', () => {
  const page = source('./Dashboard.jsx')
  assert.match(page, /queryState\.valuesVisible/)
  assert.match(page, /Ocultar valores/)
  assert.match(page, /Mostrar valores/)
  assert.match(page, /const MONEY_MASK = ['"]••••••['"]/)
  for (const value of ['totals\\.salesToday', 'totals\\.receivedToday', 'totals\\.receivables', 'metrics\\.sales', 'metrics\\.averageTicket']) assert.match(page, new RegExp(`displayMoney\\(${value}\\)`))
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie/)
})

test('cancelled orders contribute zero to commercial dashboard analytics', () => {
  const now = new Date(2026, 8, 3, 12, 0, 0)
  const valid = { id: 'ok', status: 'Finalizado', orderDate: '2026-09-03', total: 50, paymentStatus: 'Pago', paymentMethod: 'Pix', paidAmount: 50, items: [{ productId: 'p1', name: 'Marmita', quantity: 1 }] }
  const cancelled = { id: 'cancelled', status: 'Cancelado', orderDate: '2026-09-03', total: 80, paymentStatus: 'Pago', paymentMethod: 'Dinheiro', paidAmount: 80, items: [{ productId: 'p2', name: 'Lasanha', quantity: 4 }] }
  const orders = [valid, cancelled]
  assert.deepEqual(calculatePeriodMetrics(orders, 'today', now), { sales: 50, orderCount: 1, averageTicket: 50 })
  assert.equal(buildDailySeries(orders, 'today', now)[0].sales, 50)
  assert.equal(buildDailySeries(orders, 'today', now)[0].orders, 1)
  assert.deepEqual(getTopProducts(orders, 'today', now), [{ key: 'id:p1', label: 'Marmita', quantity: 1 }])
  assert.deepEqual(getPaymentMix(orders, 'today', now), [{ method: 'Pix', amount: 50 }])
})
