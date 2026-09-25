import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'

test('sales renders financial decomposition, series and formatted payment mix', async (t) => {
  const harness = await workspaceHarness(t)
  const { SalesReport } = await harness.load('/src/domains/reporting/ui/views/SalesReport.jsx')
  const renderer = await harness.render(SalesReport, { state: { loading: false, data: {
    salesCents: 1000, ordersCount: 1, averageTicketCents: 1000, receivedCents: 700,
    merchandiseRevenueCents: 900, deliveryFeesCents: 100, discountCents: 50, surchargeCents: 0,
    receivableCents: 300, receivableCount: 1, cancellationCount: 0, refundsCents: 0,
    paymentMix: [{ method: 'Pix', amountCents: 700 }],
    receivables: { overdue: { count: 0, amountCents: 0 }, today: { count: 1, amountCents: 300 }, upcoming: { count: 0, amountCents: 0 } },
    salesSeries: [{ date: '2026-09-10', cents: 1000 }], ordersSeries: [{ date: '2026-09-10', count: 1 }],
    receivedSeries: [{ date: '2026-09-10', cents: 700 }], refundSeries: [],
  } } })
  const text = nodeText(renderer.root)
  assert.match(text, /Descontos/)
  assert.match(text, /A receber do período/)
  assert.match(text, /Vendas por dia/)
  assert.match(text, /Recebimentos por dia/)
  assert.match(text, /Pix: R\$\s*7,00/)
  assert.doesNotMatch(text, /Pix: 700/)
})
