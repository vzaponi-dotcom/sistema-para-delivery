import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'

test('overview renders all eight KPIs, metric-specific comparison and a non-blocking warning', async (t) => {
  const harness = await workspaceHarness(t)
  const { OverviewReport } = await harness.load('/src/domains/reporting/ui/views/OverviewReport.jsx')
  const metrics = {
    salesCents: 1500, ordersCount: 1, averageTicketCents: 1500, receivedCents: 0,
    receivableCents: 1500, cancellationRate: null, refundsCents: 0, withinDeadlineRate: 100,
  }
  const drilled = []
  const renderer = await harness.render(OverviewReport, { state: {
    data: { metrics }, loading: false, error: null,
    comparison: { metrics: { salesCents: { available: true, previous: 1000, delta: 500, percent: 50, direction: 'higher_better' } } },
    warnings: ['Cobertura operacional parcial'],
  }, onDrilldown: (patch) => drilled.push(patch) })
  const cards = renderer.root.findAll((node) => node.props?.className?.includes?.('reporting-metric-card'))
  assert.equal(cards.length, 8)
  assert.match(nodeText(renderer.root), /50%.*Melhora/)
  assert.match(nodeText(renderer.root), /Indisponível/)
  assert.match(nodeText(renderer.root), /Cobertura operacional parcial/)
  renderer.root.findByProps({ 'aria-label': 'Ver detalhes: A receber do período' }).props.onClick()
  assert.deepEqual(drilled, [{ view: 'detail', receivable: 'unpaid', status: null }])
})
