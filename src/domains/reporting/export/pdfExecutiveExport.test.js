import test from 'node:test'
import assert from 'node:assert/strict'

test('executive PDF view model combines official overview, operation, products and modality data', async () => {
  const { buildExecutivePdfViewModel } = await import('./pdfExport.js')
  const vm = buildExecutivePdfViewModel({
    generatedAt: '2026-09-25T17:32:00Z',
    operation: { name: 'Amor & Sabor' },
    period: { from: '2026-09-01', to: '2026-09-25' },
    filters: { view: 'sales', from: '2026-09-01', to: '2026-09-25', paymentMethod: 'pix' },
    executive: {
      overview: {
        data: { metrics: {
          salesCents: 1_039_836, ordersCount: 167, averageTicketCents: 6_173,
          receivedCents: 743_436, receivableCents: 288_600, cancellationRate: 11.76,
        } },
        comparison: { metrics: {
          salesCents: { available: true, percent: 12.4, delta: 114_000, direction: 'higher_better' },
          ordersCount: { available: true, percent: 8.4, delta: 13, direction: 'higher_better' },
          averageTicketCents: { available: true, percent: 3.7, delta: 220, direction: 'higher_better' },
          receivedCents: { available: true, percent: 15.1, delta: 97_000, direction: 'higher_better' },
          receivableCents: { available: true, percent: -2.8, delta: -8_300, direction: 'lower_better' },
          cancellationRate: { available: true, percent: -21.4, delta: -3.2, direction: 'lower_better' },
        } },
      },
      operation: { data: { withinDeadlineRate: 95.2 }, quality: { eligibleCount: 160, measuredCount: 158 } },
      products: { data: {
        merchandiseRevenueCents: 920_000,
        categories: [
          { category: 'Pratos principais', revenueCents: 416_000 },
          { category: 'Lanches', revenueCents: 228_000 },
        ],
        top10: [{ name: 'X-Burger Artesanal', quantity: 42, revenueCents: 264_600, sharePercent: 25.4 }],
      } },
      modalities: [
        { label: 'Entrega', revenueCents: 650_000, sharePercent: 62.5 },
        { label: 'Retirada', revenueCents: 389_836, sharePercent: 37.5 },
      ],
    },
  })

  assert.equal(vm.operationName, 'Amor & Sabor')
  assert.equal(vm.metrics.ordersCount, 167)
  assert.equal(vm.categories[0].label, 'Pratos principais')
  assert.equal(vm.topProducts[0].name, 'X-Burger Artesanal')
  assert.equal(vm.modalities[0].label, 'Entrega')
  assert.match(vm.filtersLabel, /Forma de pagamento: Pix/)
  assert.equal(vm.insights.length, 3)
  assert.equal(vm.observations.length, 3)
})

test('executive PDF renders exactly two A4 pages', async () => {
  const { createPdfSummary } = await import('./pdfExport.js')
  const pdf = await createPdfSummary({
    generatedAt: '2026-09-25T17:32:00Z',
    operation: { name: 'Amor & Sabor' },
    period: { from: '2026-09-01', to: '2026-09-25' },
    executive: {
      overview: { data: { metrics: { salesCents: 1000, ordersCount: 1, averageTicketCents: 1000, receivedCents: 1000, receivableCents: 0, cancellationRate: 0 } }, comparison: { metrics: {} } },
      operation: { data: { withinDeadlineRate: 100 } },
      products: { data: { merchandiseRevenueCents: 1000, categories: [], top10: [] } },
      modalities: [],
    },
  })
  assert.equal(pdf.getNumberOfPages(), 2)
  assert.equal(typeof pdf.output, 'function')
})