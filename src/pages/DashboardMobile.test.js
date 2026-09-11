import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('dashboard period selector remains touch friendly without a financial FAB', async () => {
  const css = await read('../dashboard.css')
  const page = await read('./Dashboard.jsx')

  assert.match(css, /\.dashboard-period-option\s*\{[^}]*min-height:\s*44px/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.dashboard-period-selector\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s)
  assert.doesNotMatch(page, /newOrderFab|createPortal/)
})

test('dashboard charts use compact sales-axis labels and compensate for SVG scaling on small screens', async () => {
  const page = await read('./Dashboard.jsx')
  const lineChart = await read('../components/DashboardLineChart.jsx')
  const css = await read('../dashboard.css')

  assert.match(page, /formatCompactAxisValue/)
  assert.match(page, /formatAxisValue=\{formatCompactAxisValue\}/)
  assert.match(lineChart, /formatAxisValue/)
  assert.match(lineChart, /formatAxisValue\(maxValue \* ratio\)/)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.dashboard-chart-axis\s*\{[^}]*font-size:\s*15px/s)
  assert.match(css, /@media\s*\(max-width:\s*390px\)[\s\S]*\.dashboard-chart-axis\s*\{[^}]*font-size:\s*20px/s)
})

test('dashboard removes recent operational orders and their dedicated responsive rules', async () => {
  const css = await read('../dashboard.css')
  const page = await read('./Dashboard.jsx')

  assert.doesNotMatch(page, /Pedidos recentes|recent-orders/)
  assert.doesNotMatch(css, /dashboard-recent-section/)
})
