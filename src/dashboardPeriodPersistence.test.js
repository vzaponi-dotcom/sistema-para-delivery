import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const appShell = fs.readFileSync(new URL('./app/shell/AppShell.jsx', import.meta.url), 'utf8')
const dashboard = fs.readFileSync(new URL('./app/surfaces/dashboard/DashboardSurface.jsx', import.meta.url), 'utf8')
const providerUrl = new URL('./components/DashboardPeriodProvider.jsx', import.meta.url)
const contextUrl = new URL('./components/dashboardPeriodContext.js', import.meta.url)
const queryContext = fs.readFileSync(new URL('./app/navigation/queryContext.js', import.meta.url), 'utf8')

test('dashboard period stays in query context without a shell-specific provider', () => {
  assert.equal(fs.existsSync(providerUrl), false)
  assert.equal(fs.existsSync(contextUrl), false)
  assert.doesNotMatch(appShell, /DashboardPeriodProvider|dashboardPeriod|onDashboardPeriodChange/)
  assert.match(appShell, /\{children\}/)
  assert.match(dashboard, /const period = queryState\.period/)
  assert.match(dashboard, /const setPeriod = \(nextPeriod\) => onQueryChange\(\{ period: nextPeriod \}\)/)
  assert.match(dashboard, /DashboardPeriodSelector value=\{period\} onChange=\{setPeriod\}/)
  assert.doesNotMatch(dashboard, /useDashboardPeriod/)
  assert.doesNotMatch(app, /dashboardPeriod=|onDashboardPeriodChange=/)
})

test('a fresh authenticated query starts the dashboard period at 30 days', () => {
  assert.match(queryContext, /dashboard: \{ period: '30d', valuesVisible: true \}/)
})
