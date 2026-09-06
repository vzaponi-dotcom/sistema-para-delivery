import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildDailySeries,
  calculatePeriodMetrics,
  getPaymentMix,
  getTopProducts,
} from '../utils/dashboardAnalytics.js'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('dashboard defaults analytics to 30 days and keeps the existing operational summary', () => {
  const page = source('./Dashboard.jsx')
  const provider = source('../components/DashboardPeriodProvider.jsx')

  assert.match(provider, /useState\(['"]30d['"]\)/)
  assert.match(page, /useDashboardPeriod/)
  assert.match(page, /Vendas hoje/)
  assert.match(page, /Recebido hoje/)
  assert.match(page, /A receber/)
  assert.match(page, /Pedidos ativos/)
  assert.match(page, /Vendas no período/)
  assert.match(page, /Pedidos no período/)
  assert.match(page, /Ticket médio/)
  assert.match(page, /DashboardPeriodSelector/)
})

test('dashboard renders all four approved analytics visualizations', () => {
  const page = source('./Dashboard.jsx')

  assert.match(page, /Vendas por dia/)
  assert.match(page, /Pedidos por dia/)
  assert.match(page, /Top 5 produtos/)
  assert.match(page, /Formas de pagamento/)
  assert.match(page, /DashboardLineChart/)
  assert.match(page, /DashboardBarChart/)
  assert.match(page, /DashboardPaymentMix/)
})

test('dashboard renders operational timing metrics and uses shared analytics helper', () => {
  const page = source('./Dashboard.jsx')
  const analytics = source('../utils/dashboardAnalytics.js')

  assert.match(analytics, /getOperationalDurationMinutes/)
  assert.match(page, /calculateOperationalMetrics/)
  assert.match(page, /Tempo operacional/)
  assert.match(page, /Tempo médio/)
  assert.match(page, /Mais rápido/)
  assert.match(page, /Mais demorado/)
  assert.match(page, /Por faixa de tempo/)
  assert.match(page, /Por tipo de atendimento/)
  assert.match(page, /Sem pedidos concluídos elegíveis neste período/)
  assert.match(page, /Em preparo e agendados/)
})

test('one global eye control starts visible and masks dashboard money without persistence', () => {
  const page = source('./Dashboard.jsx')

  assert.match(page, /useState\(true\)/)
  assert.match(page, /Ocultar valores/)
  assert.match(page, /Mostrar valores/)
  assert.match(page, /const MONEY_MASK = ['"]••••••['"]/)
  assert.match(page, /displayMoney\(totals\.salesToday\)/)
  assert.match(page, /displayMoney\(totals\.receivedToday\)/)
  assert.match(page, /displayMoney\(totals\.receivables\)/)
  assert.match(page, /displayMoney\(metrics\.sales\)/)
  assert.match(page, /displayMoney\(metrics\.averageTicket\)/)
  assert.match(page, /displayMoney\(order\.total\)/)
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie/)
})

test('cancelled orders contribute zero to commercial dashboard analytics', () => {
  const now = new Date(2026, 8, 3, 12, 0, 0)
  const valid = {
    id: 'ok',
    status: 'Finalizado',
    orderDate: '2026-09-03',
    total: 50,
    paymentStatus: 'Pago',
    paymentMethod: 'Pix',
    paidAmount: 50,
    items: [{ productId: 'p1', name: 'Marmita', quantity: 1 }],
  }
  const cancelled = {
    id: 'cancelled',
    status: 'Cancelado',
    orderDate: '2026-09-03',
    total: 80,
    paymentStatus: 'Pago',
    paymentMethod: 'Dinheiro',
    paidAmount: 80,
    items: [{ productId: 'p2', name: 'Lasanha', quantity: 4 }],
  }

  const orders = [valid, cancelled]
  assert.deepEqual(calculatePeriodMetrics(orders, 'today', now), { sales: 50, orderCount: 1, averageTicket: 50 })
  assert.equal(buildDailySeries(orders, 'today', now)[0].sales, 50)
  assert.equal(buildDailySeries(orders, 'today', now)[0].orders, 1)
  assert.deepEqual(getTopProducts(orders, 'today', now), [{ key: 'id:p1', label: 'Marmita', quantity: 1 }])
  assert.deepEqual(getPaymentMix(orders, 'today', now), [{ method: 'Pix', amount: 50 }])
})
