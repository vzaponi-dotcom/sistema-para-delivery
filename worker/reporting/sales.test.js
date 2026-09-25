import test from 'node:test'
import assert from 'node:assert/strict'

test('sales counts receipt once and payment allocations only for mix', async () => {
  const { createReportingService } = await import('./service.js')
  const repository = { async loadSales() { return {
    orders: [{ id: 'order', status: 'Finalizado', total_cents: 1200, delivery_fee_cents: 200, table_tab_id: null }],
    receipts: [{ id: 'receipt', total_cents: 1200 }],
    allocations: [{ receipt_id: 'receipt', method_code: 'pix', method_label: 'Pix', amount_cents: 700 }, { receipt_id: 'receipt', method_code: 'cash', method_label: 'Dinheiro', amount_cents: 500 }],
    payments: [], refunds: [],
  } } }
  const result = await createReportingService(repository).sales('business-a', { from: '2026-09-01', to: '2026-09-30' })
  assert.equal(result.data.receivedCents, 1200)
  assert.equal(result.data.merchandiseRevenueCents, 1000)
  assert.equal(result.data.deliveryFeesCents, 200)
  assert.deepEqual(result.data.paymentMix, [{ method: 'Dinheiro', amountCents: 500 }, { method: 'Pix', amountCents: 700 }])
})
