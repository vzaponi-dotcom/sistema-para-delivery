import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')
const absent = (path) => assert.rejects(access(new URL(path, import.meta.url)), (error) => error?.code === 'ENOENT')

test('Dashboard is owned by the app surface and legacy owners are absent', async () => {
  const [surface, app, shell] = await Promise.all([
    read('./DashboardSurface.jsx'),
    read('../../../App.jsx'),
    read('../../shell/AppShell.jsx'),
  ])

  assert.match(app, /import DashboardSurface from ['"]\.\/app\/surfaces\/dashboard\/DashboardSurface\.jsx['"]/)
  assert.doesNotMatch(app, /pages\/Dashboard/)
  assert.doesNotMatch(app, /const totals = useMemo/)
  assert.match(app, /<DashboardSurface[^>]*orders=\{orders\}[^>]*movements=\{movements\}/s)
  assert.doesNotMatch(shell, /DashboardPeriodProvider|dashboardPeriod|onDashboardPeriodChange/)
  assert.match(surface, /const period = queryState\.period/)
  assert.match(surface, /onQueryChange\(\{ period:/)
  assert.match(surface, /calculateReceivedToday\(movements, todayValue\)/)

  await absent('../../../pages/Dashboard.jsx')
  await absent('../../../utils/dashboardAnalytics.js')
  await absent('../../../components/DashboardPeriodProvider.jsx')
  await absent('../../../components/dashboardPeriodContext.js')
})

test('Dashboard-only charts are co-located with the Dashboard surface', async () => {
  const [surface, line, payment] = await Promise.all([
    read('./DashboardSurface.jsx'),
    read('./DashboardLineChart.jsx'),
    read('./DashboardPaymentMix.jsx'),
  ])
  assert.match(surface, /\.\/DashboardLineChart\.jsx/)
  assert.match(surface, /\.\/DashboardPaymentMix\.jsx/)
  assert.match(line, /<svg/)
  assert.match(payment, /dashboard-payment-segment/)
  await absent('../../../components/DashboardLineChart.jsx')
  await absent('../../../components/DashboardPaymentMix.jsx')
})
