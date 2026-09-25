import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'

test('metric card distinguishes unavailable from a genuine zero and presents its own comparison', async (t) => {
  const harness = await workspaceHarness(t)
  const { ReportingMetricCard } = await harness.load('/src/domains/reporting/ui/ReportingMetricCard.jsx')
  const unavailable = await harness.render(ReportingMetricCard, { label: 'Ticket médio', value: null })
  assert.match(nodeText(unavailable.root), /Indisponível/)
  assert.doesNotMatch(nodeText(unavailable.root), /R\$\s*0,00/)
  const zero = await harness.render(ReportingMetricCard, { label: 'Recebido', value: 0 })
  assert.match(nodeText(zero.root), /R\$\s*0,00/)
  const compared = await harness.render(ReportingMetricCard, {
    label: 'Vendas', value: 1500, comparison: { previous: 1000, delta: 500, percent: 50, available: true, direction: 'higher_better' },
  })
  assert.match(nodeText(compared.root), /50%/)
})
