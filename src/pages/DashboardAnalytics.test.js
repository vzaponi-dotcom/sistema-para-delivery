import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('dashboard defaults analytics to 30 days and keeps the existing operational summary', () => {
  const page = source('./Dashboard.jsx')

  assert.match(page, /useState\(['"]30d['"]\)/)
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
