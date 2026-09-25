import test from 'node:test'
import assert from 'node:assert/strict'

test('PDF summary is created from official supplied metrics', async () => {
  const { createPdfSummary } = await import('./pdfExport.js')
  const pdf = await createPdfSummary({ generatedAt: '2026-09-25', metrics: { Vendas: 'R$ 10,00' } })
  assert.equal(typeof pdf.output, 'function')
})
