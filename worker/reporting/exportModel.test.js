import test from 'node:test'
import assert from 'node:assert/strict'

test('export model reuses official detail rows, selected columns and report summary', async () => {
  const { createExportModel } = await import('./exportModel.js')
  const query = { view: 'sales', period: 'custom', from: '2026-09-01', to: '2026-09-10' }
  const model = createExportModel({ query, report: { data: { salesCents: 1234 }, quality: { count: 1 } },
    detail: { total: 1, items: [{ order_number: 1, total_cents: 1234 }] }, columns: ['order_number', 'total_cents'],
    operation: { id: 'business-a', name: 'Amor & Sabor', slug: 'amor-sabor' }, generatedAt: '2026-09-10T12:00:00Z' })
  assert.deepEqual(model.columns, ['Pedido', 'Total'])
  assert.deepEqual(model.rows, [[1, 1234]])
  assert.equal(model.summary.salesCents, 1234)
  assert.deepEqual(model.operation, { id: 'business-a', name: 'Amor & Sabor', slug: 'amor-sabor' })
  assert.equal(model.filters.from, '2026-09-01')
  assert.equal(model.timezone, 'America/Sao_Paulo')
})

test('export accepts exactly 10,000 rows and explicitly rejects 10,001 without truncation', async () => {
  const { createExportModel } = await import('./exportModel.js')
  const base = { query: { view: 'detail', from: '2026-09-01', to: '2026-09-30' }, report: { data: {} }, columns: ['order_number'] }
  const items = Array.from({ length: 10_000 }, (_, index) => ({ order_number: index + 1 }))
  assert.equal(createExportModel({ ...base, detail: { total: 10_000, items } }).rows.length, 10_000)
  assert.throws(() => createExportModel({ ...base, detail: { total: 10_001, items } }), { status: 422, code: 'REPORTING_EXPORT_LIMIT' })
})
