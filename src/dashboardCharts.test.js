import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('dashboard charts are local SVG/CSS components without a chart dependency', () => {
  const line = source('./components/DashboardLineChart.jsx')
  const bar = source('./components/DashboardBarChart.jsx')
  const payment = source('./components/DashboardPaymentMix.jsx')
  const combined = `${line}\n${bar}\n${payment}`

  assert.match(line, /<svg/)
  assert.match(line, /role="img"/)
  assert.match(line, /valuesVisible/)
  assert.match(bar, /orientation === ['"]horizontal['"]/)
  assert.match(bar, /<svg/)
  assert.match(payment, /dashboard-payment-segment/)
  assert.match(payment, /valuesVisible/)
  assert.doesNotMatch(combined, /recharts|chart\.js|highcharts|from ['"]d3/)
})

test('monetary chart accessibility copy changes when values are hidden', () => {
  const line = source('./components/DashboardLineChart.jsx')
  const payment = source('./components/DashboardPaymentMix.jsx')

  assert.match(line, /Valores ocultos/)
  assert.match(payment, /Valores ocultos/)
})
