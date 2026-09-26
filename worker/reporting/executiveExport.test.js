import test from 'node:test'
import assert from 'node:assert/strict'

test('canonical export model derives executive modality participation from filtered commercial orders', async () => {
  const { createExportModel } = await import('./exportModel.js')
  const executive = {
    overview: { data: { metrics: { salesCents: 1500 } }, comparison: { metrics: {} } },
    operation: { data: { withinDeadlineRate: 90 } },
    products: { data: { merchandiseRevenueCents: 1400, categories: [], top10: [] } },
  }
  const model = createExportModel({
    query: { view: 'overview', from: '2026-09-01', to: '2026-09-25' },
    report: executive.overview,
    detail: { total: 3, items: [
      { order_number: 1, status: 'Finalizado', type: 'Entrega', total_cents: 1000 },
      { order_number: 2, status: 'Finalizado', type: 'Retirada', total_cents: 500 },
      { order_number: 3, status: 'Cancelado', type: 'Entrega', total_cents: 900 },
    ] },
    executive,
  })
  assert.equal(model.executive.overview, executive.overview)
  assert.deepEqual(model.executive.modalities, [
    { label: 'Entrega', revenueCents: 1000, sharePercent: 66.67 },
    { label: 'Retirada', revenueCents: 500, sharePercent: 33.33 },
  ])
})

test('PDF export service enriches the canonical model with overview, operation and products without changing data exports', async () => {
  const { createReportingService } = await import('./service.js')
  const calls = { detail: 0, overview: 0, operational: 0, products: 0 }
  const repository = {
    async listDetail() {
      calls.detail += 1
      return { total: 1, items: [{ order_number: 1, status: 'Finalizado', type: 'Entrega', total_cents: 1000 }] }
    },
    async getBusinessIdentity() { return { id: 'a', name: 'Amor & Sabor', slug: 'amor-sabor' } },
    async loadOverview() {
      calls.overview += 1
      return { orders: [{ id: 'o1', status: 'Finalizado', total_cents: 1000, table_tab_id: null }], payments: [], receipts: [], refunds: [] }
    },
    async listOperationalOrders() {
      calls.operational += 1
      return []
    },
    async loadProductLines() {
      calls.products += 1
      return []
    },
  }
  const query = { view: 'overview', period: 'custom', from: '2026-09-01', to: '2026-09-25' }
  const service = createReportingService(repository)
  const pdf = await service.exportModel('a', query, null, 'pdf')
  assert.ok(pdf.data.executive.overview)
  assert.ok(pdf.data.executive.operation)
  assert.ok(pdf.data.executive.products)
  assert.equal(pdf.data.executive.modalities[0].label, 'Entrega')

  const dataOnly = await service.exportModel('a', query, null, null)
  assert.equal(Object.hasOwn(dataOnly.data, 'executive'), false)
  assert.ok(calls.detail >= 2)
})