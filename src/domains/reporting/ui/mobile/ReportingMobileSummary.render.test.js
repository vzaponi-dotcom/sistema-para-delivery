import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText } from '../../../../test-support/renderWorkspace.js'

test('mobile composes overview, sales, operation and products from reporting API without a desktop table', async (t) => {
  const harness = await workspaceHarness(t, { mobile: true })
  const { ReportingMobileSummary } = await harness.load('/src/domains/reporting/ui/mobile/ReportingMobileSummary.jsx')
  const loaded = []
  const api = { load: async (view) => {
    loaded.push(view)
    const data = {
      overview: { metrics: { salesCents: 1000, ordersCount: 1, averageTicketCents: 1000, receivableCents: 0 } },
      sales: { salesSeries: [{ date: '2026-09-10', cents: 1000 }], salesCents: 1000, receivedCents: 900 },
      operation: { operationalOrdersCount: 1, averageDurationMinutes: 20, withinDeadlineRate: 100 },
      products: { top10: [{ id: 'p1', name: 'X-Bacon', quantity: 1, revenueCents: 1000 }] },
    }[view]
    return { data, warnings: [] }
  } }
  const renderer = await harness.render(ReportingMobileSummary, { query: { view: 'detail', from: '2026-09-10', to: '2026-09-10' }, detailState: { data: { items: [
    { id: 'o1', order_number: 1, client_name_snapshot: 'Ana', total_cents: 1000 },
    { id: 'f9a1cb3b-d4fb-405f-b3ad-ca7027fa92a3', order_number: null, client_name_snapshot: 'Bia', total_cents: 500 },
  ] } }, api })
  const text = nodeText(renderer.root)
  for (const label of ['Resumo do período', 'Tendência de vendas', 'Top produtos', 'Resumo da operação', 'Resumo de vendas', 'Pedidos detalhados', 'X-Bacon']) assert.match(text, new RegExp(label))
  assert.deepEqual(loaded.sort(), ['operation', 'overview', 'products', 'sales'])
  assert.equal(renderer.root.findAllByType('table').length, 0)
  assert.equal(renderer.root.findAllByProps({ href: '/financeiro/a-receber' }).length, 1)
  assert.match(text, /Gerenciar em A receber/)
  assert.match(text, /Sem nº · f9a1cb3b/)
  assert.doesNotMatch(text, /#null|pedido null/i)
})
