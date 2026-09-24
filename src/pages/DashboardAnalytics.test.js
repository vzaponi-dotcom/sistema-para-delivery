import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildDailySeries, calculatePeriodMetrics, getMealsSold, getPaymentMix, getTopProducts } from '../app/surfaces/dashboard/dashboardAnalytics.js'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('dashboard keeps the approved financial summary and 30-day commercial period', () => {
  const page = source('../app/surfaces/dashboard/DashboardSurface.jsx')
  const query = source('../app/navigation/queryContext.js')
  assert.match(query, /dashboard: \{ period: '30d', valuesVisible: true \}/)
  for (const label of ['Vendas hoje', 'Recebido hoje', 'A receber', 'Vendas no período', 'Pedidos no período', 'Ticket médio', 'Refeições vendidas']) assert.match(page, new RegExp(label))
  assert.match(page, /DashboardPeriodSelector/)
  assert.match(page, /getMealsSold\(orders, period, now\)/)
  assert.match(page, /const \{ metrics, daily, topProducts, mealsSold, paymentMix \} = analytics/)
  assert.match(page, /className="stats-grid dashboard-period-stats"/)
  assert.match(page, /<StatCard label="Refeições vendidas" value=\{mealsSold\} helper="Unidades da categoria Refeições" icon="meal" \/>/)
  assert.doesNotMatch(page, /Pedidos ativos/)
})

test('dashboard renders all four approved commercial visualizations', () => {
  const page = source('../app/surfaces/dashboard/DashboardSurface.jsx')
  for (const label of ['Vendas por dia', 'Pedidos por dia', 'Top 10 produtos', 'Formas de pagamento']) assert.match(page, new RegExp(label))
  assert.match(page, /ariaLabel="Top 10 produtos por quantidade vendida"/)
  assert.match(page, /DashboardLineChart/)
  assert.match(page, /DashboardBarChart/)
  assert.match(page, /DashboardPaymentMix/)
})

test('dashboard leaves operational timing and recent orders to history', () => {
  const page = source('../app/surfaces/dashboard/DashboardSurface.jsx')
  const analysis = source('../domains/orders/ui/components/OperationalHistoryAnalysis.jsx')
  assert.doesNotMatch(page, /calculateOperationalMetrics|Tempo operacional|Pedidos recentes/)
  assert.match(analysis, /calculateOperationalMetrics/)
  assert.match(analysis, /Tempo operacional/)
  assert.match(analysis, /Por faixa de tempo/)
  assert.match(analysis, /Por tipo de atendimento/)
})

test('one global eye control masks dashboard money without persistence', () => {
  const page = source('../app/surfaces/dashboard/DashboardSurface.jsx')
  assert.match(page, /queryState\.valuesVisible/)
  assert.match(page, /Ocultar valores/)
  assert.match(page, /Mostrar valores/)
  assert.match(page, /const MONEY_MASK = ['"]••••••['"]/)
  for (const value of ['totals\\.salesToday', 'totals\\.receivedToday', 'totals\\.receivables', 'metrics\\.sales', 'metrics\\.averageTicket']) assert.match(page, new RegExp(`displayMoney\\(${value}\\)`))
  assert.match(page, /value=\{mealsSold\}/)
  assert.doesNotMatch(page, /displayMoney\(mealsSold\)/)
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie/)
})

test('cancelled orders contribute zero to commercial dashboard analytics', () => {
  const now = new Date(2026, 8, 3, 12, 0, 0)
  const valid = { id: 'ok', status: 'Finalizado', orderDate: '2026-09-03', total: 50, paymentStatus: 'Pago', paymentMethod: 'Pix', paidAmount: 50, items: [{ productId: 'p1', name: 'Marmita', category: 'Refeições', quantity: 1 }] }
  const cancelled = { id: 'cancelled', status: 'Cancelado', orderDate: '2026-09-03', total: 80, paymentStatus: 'Pago', paymentMethod: 'Dinheiro', paidAmount: 80, items: [{ productId: 'p2', name: 'Lasanha', category: 'Refeições', quantity: 4 }] }
  const orders = [valid, cancelled]
  assert.deepEqual(calculatePeriodMetrics(orders, 'today', now), { sales: 50, orderCount: 1, averageTicket: 50 })
  assert.equal(buildDailySeries(orders, 'today', now)[0].sales, 50)
  assert.equal(buildDailySeries(orders, 'today', now)[0].orders, 1)
  assert.deepEqual(getTopProducts(orders, 'today', now), [{ key: 'id:p1', label: 'Marmita', quantity: 1 }])
  assert.equal(getMealsSold(orders, 'today', now), 1)
  assert.deepEqual(getPaymentMix([
    { id: 'sale', type: 'entrada', source: 'order-payment', paymentMethod: 'Pix', value: 50, movementDate: '2026-09-03' },
    { id: 'cancel-refund', type: 'saida', source: 'order-refund', paymentMethod: 'Dinheiro', value: 80, movementDate: '2026-09-03' },
  ], 'today', now), [{ method: 'Pix', amount: 50 }])
})

test('dashboard payment mix is wired to financial movements instead of scalar order payment fields', () => {
  const page = source('../app/surfaces/dashboard/DashboardSurface.jsx')
  assert.match(page, /getPaymentMix\(movements, period, now\)/)
  assert.match(page, /Movimentos recebidos/)
  assert.doesNotMatch(page, /getPaymentMix\(orders/)
})


test('Mesiva financial overview separates brand sales from payment and receivable states', () => {
  const page = source('../app/surfaces/dashboard/DashboardSurface.jsx')
  const css = source('../app/surfaces/dashboard/dashboard.css')

  assert.match(page, /label="Vendas hoje"[^>]*className="dashboard-stat-sales"/)
  assert.match(page, /label="Vendas no período"[^>]*className="dashboard-stat-sales"/)
  assert.match(page, /label="A receber"[^>]*className="dashboard-stat-receivable"/)

  assert.match(
    css,
    /:root\[data-visual-theme=['"]mesiva['"]\] \.dashboard-stat-sales \.stat-icon\s*\{[^}]*background:\s*var\(--primary-soft\)[^}]*color:\s*var\(--brand\)/s,
  )
  assert.match(
    css,
    /:root\[data-visual-theme=['"]mesiva['"]\] \.dashboard-stat-receivable \.stat-icon\s*\{[^}]*background:\s*var\(--surface-strong\)[^}]*color:\s*var\(--text-soft\)/s,
  )
})
