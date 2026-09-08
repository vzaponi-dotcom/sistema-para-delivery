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

test('dashboard metric cards use two columns on mobile', () => {
  const css = source('./App.css')

  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.stats-grid\s*,\s*\.stats-grid-three\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)/)
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.stats-grid-three \.stat-card:last-child\s*\{[\s\S]*grid-column:\s*auto/)
})

test('dashboard KPI values stay on one line with smaller mobile typography', () => {
  const css = source('./App.css')
  const desktopValueRule = css.match(/\.stat-copy strong\s*\{([^}]*)\}/)
  const mobileValueRule = css.match(/@media \(max-width: 640px\)[\s\S]*?\.stat-copy strong\s*\{([^}]*)\}/)

  assert.ok(desktopValueRule)
  assert.ok(mobileValueRule)
  assert.match(mobileValueRule[1], /font-size:\s*clamp\(1rem,/)
  assert.match(mobileValueRule[1], /white-space:\s*nowrap/)
  assert.match(mobileValueRule[1], /overflow-wrap:\s*normal/)
  assert.match(desktopValueRule[1], /font-size:\s*clamp\(1\.55rem,/)
})

test('dashboard KPI cards reserve enough copy width at 320px', () => {
  const css = source('./App.css')
  const compactCardRule = css.match(/@media \(max-width: 390px\)[\s\S]*?\.stat-card\s*\{([^}]*)\}/)
  const compactIconRule = css.match(/@media \(max-width: 390px\)[\s\S]*?\.stat-icon\s*\{([^}]*)\}/)
  const compactValueRule = css.match(/@media \(max-width: 390px\)[\s\S]*?\.stat-copy strong\s*\{([^}]*)\}/)

  assert.ok(compactCardRule)
  assert.ok(compactIconRule)
  assert.ok(compactValueRule)
  assert.match(compactCardRule[1], /padding:\s*8px/)
  assert.match(compactCardRule[1], /gap:\s*6px/)
  assert.match(compactIconRule[1], /width:\s*30px/)
  assert.match(compactValueRule[1], /font-size:\s*0\.9rem/)
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
