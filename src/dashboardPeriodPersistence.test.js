import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const dashboard = fs.readFileSync(new URL('./pages/Dashboard.jsx', import.meta.url), 'utf8')

test('dashboard period is owned by App and passed as a controlled value', () => {
  assert.match(app, /const \[dashboardPeriod, setDashboardPeriod\] = useState\('30d'\)/)
  assert.match(app, /<Dashboard[\s\S]*period=\{dashboardPeriod\}[\s\S]*onPeriodChange=\{setDashboardPeriod\}/)
  assert.doesNotMatch(dashboard, /const \[period, setPeriod\] = useState/)
  assert.match(dashboard, /function Dashboard\(\{[^}]*period[^}]*onPeriodChange/)
  assert.match(dashboard, /DashboardPeriodSelector value=\{period\} onChange=\{onPeriodChange\}/)
})

test('ending the business session restores the default 30 day period', () => {
  assert.match(app, /const clearBusinessData = \(\) => \{[\s\S]*setDashboardPeriod\('30d'\)/)
})
