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
  assert.match(text, /PixR\$\s*7,00/)
  assert.doesNotMatch(text, /Pix700/)
})

test('sales tolerates a partial payload without crashing while optional collections are absent', async (t) => {
  const harness = await workspaceHarness(t)
  const { SalesReport } = await harness.load('/src/domains/reporting/ui/views/SalesReport.jsx')
  const renderer = await harness.render(SalesReport, { state: { loading: false, data: {
    salesCents: 0, ordersCount: 0, averageTicketCents: null, receivedCents: 0,
    merchandiseRevenueCents: 0, deliveryFeesCents: 0, discountCents: 0, surchargeCents: 0,
    receivableCents: 0, receivableCount: 0, cancellationCount: 0, refundsCents: 0,
  } } })
  assert.match(nodeText(renderer.root), /Mix por forma de pagamento/)
})


test('sales uses visual panels, keeps drilldown and moves A receber action inside its panel', async (t) => {
  const harness = await workspaceHarness(t)
  const { SalesReport } = await harness.load('/src/domains/reporting/ui/views/SalesReport.jsx')
  const drilled = []
  const renderer = await harness.render(SalesReport, { state: { loading: false, data: {
    salesCents: 10000, ordersCount: 3, averageTicketCents: 3333, receivedCents: 8000,
    merchandiseRevenueCents: 9000, deliveryFeesCents: 1000, discountCents: 0, surchargeCents: 0,
    receivableCents: 2000, receivableCount: 1, cancellationCount: 0, refundsCents: 0,
    paymentMix: [{ method: 'Pix', amountCents: 6000 }, { method: 'Dinheiro', amountCents: 2000 }],
    receivables: { overdue: { count: 0, amountCents: 0 }, today: { count: 1, amountCents: 2000 }, upcoming: { count: 0, amountCents: 0 } },
    salesSeries: [{ date: '2026-09-24', cents: 4000 }, { date: '2026-09-25', cents: 6000 }],
    ordersSeries: [{ date: '2026-09-24', count: 1 }, { date: '2026-09-25', count: 2 }],
    receivedSeries: [{ date: '2026-09-25', cents: 8000 }], refundSeries: [],
  }, warnings: [] }, onDrilldown: (patch) => drilled.push(patch) })

  assert.ok(renderer.root.findByProps({ 'aria-label': 'Vendas por dia no período selecionado' }))
  assert.ok(renderer.root.findByProps({ 'aria-label': 'Pedidos por dia no período selecionado' }))
  assert.ok(renderer.root.findByProps({ 'aria-label': 'Recebimentos por dia no período selecionado' }))
  const pix = renderer.root.findAllByType('button').find((button) => nodeText(button).includes('Pix'))
  assert.ok(pix)
  pix.props.onClick()
  assert.deepEqual(drilled.at(-1), { view: 'detail', paymentMethod: 'Pix' })
  assert.match(nodeText(renderer.root), /Nenhum estorno no período/)
  assert.equal(renderer.root.findAllByProps({ href: '/financeiro/a-receber' }).length, 1)
  assert.match(nodeText(renderer.root), /Como interpretar estes números/)
})

test('sales empty visual panels explain absence of movement instead of rendering blank cards', async (t) => {
  const harness = await workspaceHarness(t)
  const { SalesReport } = await harness.load('/src/domains/reporting/ui/views/SalesReport.jsx')
  const renderer = await harness.render(SalesReport, { state: { loading: false, data: {
    salesCents: 0, ordersCount: 0, averageTicketCents: null, receivedCents: 0,
    merchandiseRevenueCents: 0, deliveryFeesCents: 0, discountCents: 0, surchargeCents: 0,
    receivableCents: 0, receivableCount: 0, cancellationCount: 0, refundsCents: 0,
    paymentMix: [], receivables: {}, salesSeries: [], ordersSeries: [], receivedSeries: [], refundSeries: [],
  }, warnings: [] } })
  const text = nodeText(renderer.root)
  assert.match(text, /Sem movimentação no período/)
  assert.match(text, /Nenhum pedido no período/)
  assert.match(text, /Sem recebimentos no período/)
  assert.match(text, /Nenhum estorno no período/)
})
