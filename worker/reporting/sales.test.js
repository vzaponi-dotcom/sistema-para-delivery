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

test('sales returns financial decomposition, distinct date series and receivables buckets', async () => {
  const { createReportingService } = await import('./service.js')
  const repository = { async loadSales() { return {
    orders: [
      { id: 'unpaid', order_date: '2026-09-09', status: 'Finalizado', total_cents: 1200, delivery_fee_cents: 200, adjustment_type: 'discount', adjustment_amount_cents: 100, promised_payment_date: '2026-09-09', customer_identity_type: 'guest_name' },
      { id: 'paid', order_date: '2026-09-09', status: 'Finalizado', total_cents: 2000, delivery_fee_cents: 0, adjustment_type: 'surcharge', adjustment_amount_cents: 50, customer_identity_type: 'guest_name' },
      { id: 'tab', order_date: '2026-09-09', status: 'Finalizado', total_cents: 900, delivery_fee_cents: 0, customer_identity_type: 'table', table_tab_id: 'tab' },
      { id: 'cancel', order_date: '2026-09-09', status: 'Cancelado', total_cents: 700, delivery_fee_cents: 0 },
    ],
    receipts: [{ id: 'r', total_cents: 2000, paid_at: '2026-09-10T02:30:00.000Z' }],
    allocations: [{ method_label: 'Pix', amount_cents: 2000 }],
    payments: [{ order_id: 'paid', amount_cents: 2000 }],
    refunds: [{ value_cents: 300, movement_date: '2026-09-10' }],
  } } }
  const result = await createReportingService(repository).sales('a', { from: '2026-09-09', to: '2026-09-10' })
  assert.equal(result.data.ordersCount, 3)
  assert.equal(result.data.averageTicketCents, 1367)
  assert.equal(result.data.discountCents, 100)
  assert.equal(result.data.surchargeCents, 50)
  assert.equal(result.data.cancellationCount, 1)
  assert.equal(result.data.receivableCents, 1200)
  assert.equal(result.data.receivableCount, 1)
  assert.equal(result.data.receivables.overdue.count + result.data.receivables.today.count + result.data.receivables.upcoming.count, 1)
  assert.deepEqual(result.data.receivedSeries, [{ date: '2026-09-09', cents: 2000 }])
  assert.deepEqual(result.data.refundSeries, [{ date: '2026-09-10', cents: 300 }])
})
