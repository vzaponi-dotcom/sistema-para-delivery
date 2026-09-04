import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('dashboard analytics stacks on mobile and keeps tap targets usable', () => {
  const css = source('./dashboard.css')

  assert.match(css, /@media \(max-width: 820px\)/)
  assert.match(css, /@media \(max-width: 640px\)/)
  assert.match(css, /\.dashboard-analytics-grid[\s\S]*grid-template-columns:\s*1fr/)
  assert.match(css, /\.dashboard-period-option[\s\S]*min-height:\s*44px/)
  assert.match(css, /\.dashboard-privacy-toggle[\s\S]*44px/)
})

test('operational timing cards reuse responsive analytics grid', () => {
  const css = source('./dashboard.css')
  assert.match(css, /dashboard-operational-metrics/)
})

test('dashboard chart styling uses theme variables instead of hard-coded chart colors', () => {
  const css = source('./dashboard.css')

  assert.match(css, /var\(--primary\)/)
  assert.match(css, /var\(--success\)/)
  assert.match(css, /var\(--warning\)/)
  assert.match(css, /var\(--info\)/)
  assert.match(css, /var\(--purple\)/)
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}/)
})

test('hidden monetary chart copy never exposes exact values through aria labels', () => {
  const line = source('./components/DashboardLineChart.jsx')
  const payment = source('./components/DashboardPaymentMix.jsx')

  assert.match(line, /valuesVisible \? ariaLabel : `\$\{ariaLabel\}\. Valores ocultos\.`/)
  assert.match(payment, /valuesVisible[\s\S]*Valores ocultos\./)
})
