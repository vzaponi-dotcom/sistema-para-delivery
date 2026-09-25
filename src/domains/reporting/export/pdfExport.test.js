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
    quality: { invalidCount: 1, eligibleCount: 10, measuredCount: 9 },
    warnings: ['Cobertura parcial'], rows: [['não deve aparecer']],
  })
  const content = JSON.stringify(sections)
  for (const expected of ['01/09/2026', 'Modalidade', 'Entrega', 'Forma de pagamento', 'Vendas registradas', 'R$ 28.450,50', 'Mix por forma de pagamento', 'Pix', 'Cobertura parcial']) {
    assert.ok(content.replaceAll('\u00a0', ' ').includes(expected.replaceAll('\u00a0', ' ')), expected)
  }
  assert.doesNotMatch(content, /não deve aparecer/)
})
