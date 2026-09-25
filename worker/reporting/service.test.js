import test from 'node:test'
import assert from 'node:assert/strict'

test('overview keeps commercial, receipt, receivable and refund semantics separate', async () => {
  const { createReportingService } = await import('./service.js')
  const repository = {
    async loadOverview(_businessId, query) {
      if (query.to === '2026-08-31') return { orders: [], payments: [], receipts: [], refunds: [] }
      return {
        orders: [
          { id: 'finished', order_date: '2026-09-10', status: 'Finalizado', total_cents: 1_000, table_tab_id: null },
          { id: 'active', order_date: '2026-09-11', status: 'Em preparo', total_cents: 500, table_tab_id: null },
          { id: 'cancelled', order_date: '2026-09-12', status: 'Cancelado', total_cents: 900, table_tab_id: null },
          { id: 'open-tab', order_date: '2026-09-12', status: 'Finalizado', total_cents: 700, table_tab_id: 'tab-1' },
        ],
        payments: [{ order_id: 'finished', amount_cents: 1_000 }],
        receipts: [{ total_cents: 1_000 }, { total_cents: 300 }],
        refunds: [{ value_cents: 200 }],
      }
    },
  }
  const result = await createReportingService(repository).overview('business-a', { from: '2026-09-01', to: '2026-09-30' })

  assert.deepEqual(result.data.metrics, {
    salesCents: 2_200,
    ordersCount: 3,
    averageTicketCents: 733,
    receivedCents: 1_300,
    receivableCents: 500,
    receivableCount: 1,
    cancellationRate: 25,
    refundsCents: 200,
  })
  assert.equal(result.comparison.available, false)
})
