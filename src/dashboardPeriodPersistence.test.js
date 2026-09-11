import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const appShell = fs.readFileSync(new URL('./components/AppShell.jsx', import.meta.url), 'utf8')
const dashboard = fs.readFileSync(new URL('./pages/Dashboard.jsx', import.meta.url), 'utf8')
const providerUrl = new URL('./components/DashboardPeriodProvider.jsx', import.meta.url)
const contextUrl = new URL('./components/dashboardPeriodContext.js', import.meta.url)
const queryContext = fs.readFileSync(new URL('./app/queryContext.js', import.meta.url), 'utf8')

test('dashboard period is owned by the authenticated shell instead of the dashboard page', () => {
  assert.equal(fs.existsSync(providerUrl), true)
  assert.equal(fs.existsSync(contextUrl), true)
  assert.match(appShell, /import \{ DashboardPeriodProvider \} from ['"]\.\/DashboardPeriodProvider['"]/)
  assert.match(appShell, /<DashboardPeriodProvider period=\{dashboardPeriod\} onPeriodChange=\{onDashboardPeriodChange\}>[\s\S]*<div className="app-shell">[\s\S]*<\/DashboardPeriodProvider>/)
  assert.match(appShell, /\{children\}/)
  assert.doesNotMatch(dashboard, /const \[period, setPeriod\] = useState/)
  assert.match(dashboard, /const \{ period, setPeriod \} = useDashboardPeriod\(\)/)
  assert.match(dashboard, /DashboardPeriodSelector value=\{period\} onChange=\{setPeriod\}/)
})

test('a fresh authenticated query starts the dashboard period at 30 days', () => {
  const provider = fs.readFileSync(providerUrl, 'utf8')
  const context = fs.readFileSync(contextUrl, 'utf8')
  assert.doesNotMatch(provider, /useState/)
  assert.match(provider, /value=\{\{ period, setPeriod: onPeriodChange \}\}/)
  assert.match(queryContext, /dashboard: \{ period: '30d', valuesVisible: true \}/)
  assert.match(context, /export const useDashboardPeriod/)
})
