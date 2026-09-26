import test from 'node:test'
import assert from 'node:assert/strict'

test('PDF summary is created from official supplied metrics', async () => {
  const { createPdfSummary } = await import('./pdfExport.js')
  const pdf = await createPdfSummary({ generatedAt: '2026-09-25', metrics: { Vendas: 'R$ 10,00' } })
  assert.equal(typeof pdf.output, 'function')
})

test('executive PDF content includes localized period, filters, KPIs, summaries and quality without detailed rows', async () => {
  const { buildPdfExecutiveSections } = await import('./pdfExport.js')
  const sections = buildPdfExecutiveSections({
    view: 'sales', generatedAt: '2026-09-25T15:00:00Z',
    period: { from: '2026-09-01', to: '2026-09-25' },
    filters: { type: 'Entrega', paymentMethod: 'Pix', view: 'sales', page: 1 },
    summary: {
      salesCents: 2845050, ordersCount: 642, averageTicketCents: 4431,
      paymentMix: [{ method: 'Pix', amountCents: 1286090 }],
      salesSeries: [{ date: '2026-09-25', cents: 2845050 }],
    },
    comparison: { metrics: {
      salesCents: { available: true, previous: 2500000, percent: 13.8 },
      ordersCount: { available: false, previous: 0, percent: null },
    } },
    quality: { invalidCount: 1, eligibleCount: 10, measuredCount: 9 },
    warnings: ['Cobertura parcial'], rows: [['não deve aparecer']],
  })
  const content = JSON.stringify(sections)
  for (const expected of ['01/09/2026', 'Modalidade', 'Entrega', 'Forma de pagamento', 'Vendas registradas', 'R$ 28.450,50', 'Comparação com período anterior', '+13,8%', 'Pedidos: Sem base comparável', 'Mix por forma de pagamento', 'Pix', 'Cobertura parcial']) {
    assert.ok(content.replaceAll('\u00a0', ' ').includes(expected.replaceAll('\u00a0', ' ')), expected)
  }
  assert.doesNotMatch(content, /não deve aparecer/)
  assert.doesNotMatch(content, /Pedidos:.*anterior.*0/)
})


test('detail PDF uses the same executive KPI summary shape exposed by the detail report', async () => {
  const { buildPdfExecutiveSections } = await import('./pdfExport.js')
  const sections = buildPdfExecutiveSections({
    view: 'detail',
    period: { from: '2026-09-01', to: '2026-09-25' },
    summary: {
      total: 189,
      summary: { ordersCount: 189, salesCents: 1039836, averageTicketCents: 6227, cancellationRate: 11.64 },
    },
    comparison: { metrics: {
      ordersCount: { available: false, previous: 0, percent: null },
      salesCents: { available: false, previous: 0, percent: null },
    } },
    rowCount: 189,
  })
  const content = JSON.stringify(sections)
  assert.match(content, /Pedidos no período/)
  assert.match(content, /Faturamento total/)
  assert.match(content, /Ticket médio/)
  assert.match(content, /Taxa de cancelamento/)
  assert.match(content, /Comparação com período anterior/)
  assert.match(content, /Sem base comparável/)
})
