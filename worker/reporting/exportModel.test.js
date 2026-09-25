import test from 'node:test'
import assert from 'node:assert/strict'

test('export model reuses official detail rows without recalculating them', async () => {
  const { createExportModel } = await import('./exportModel.js')
  assert.deepEqual(createExportModel({ items: [{ id: '1', total_cents: 1234 }] }), { columns: ['Pedido', 'Total'], rows: [['1', 1234]] })
})
