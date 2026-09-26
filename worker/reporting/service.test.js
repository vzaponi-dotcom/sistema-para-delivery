import test from 'node:test'
import assert from 'node:assert/strict'

test('overview keeps commercial, receipt, receivable and refund semantics separate', async () => {
  const { createReportingService } = await import('./service.js')
  const repository = {
    async listOperationalOrders() { return [] },
    async loadOverview(_businessId, query) {
      if (query.to === '2026-08-31') return { orders: [], payments: [], receipts: [], refunds: [] }
      return {
        orders: [
          { id: 'finished', order_date: '2026-09-10', status: 'Finalizado', total_cents: 1_000, table_tab_id: null },
          { id: 'active', order_date: '2026-09-11', status: 'Em preparo', total_cents: 500, table_tab_id: null },
          { id: 'cancelled', order_date: '2026-09-12', status: 'Cancelado', total_cents: 900, table_tab_id: null },
          { id: 'open-tab', order_date: '2026-09-12', status: 'Finalizado', total_cents: 700, customer_identity_type: 'table', table_tab_id: 'tab-1' },
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
    withinDeadlineRate: null,
  })
  assert.equal(result.comparison.available, false)
})

test('comparison windows follow each approved preset including month-to-date alignment', async () => {
  const { previousReportingPeriod } = await import('./comparison.js')
  assert.deepEqual(previousReportingPeriod({ from: '2026-09-25', to: '2026-09-25', period: 'today' }), { from: '2026-09-24', to: '2026-09-24' })
  assert.deepEqual(previousReportingPeriod({ from: '2026-09-19', to: '2026-09-25', period: '7-days' }), { from: '2026-09-12', to: '2026-09-18' })
  assert.deepEqual(previousReportingPeriod({ from: '2026-09-01', to: '2026-09-25', period: 'current-month' }), { from: '2026-08-01', to: '2026-08-25' })
  assert.deepEqual(previousReportingPeriod({ from: '2026-08-01', to: '2026-08-31', period: 'previous-month' }), { from: '2026-07-01', to: '2026-07-31' })
  assert.deepEqual(previousReportingPeriod({ from: '2026-09-10', to: '2026-09-12', period: 'custom' }), { from: '2026-09-07', to: '2026-09-09' })
  assert.deepEqual(previousReportingPeriod({ from: '2026-03-01', to: '2026-03-31', period: 'current-month' }), { from: '2026-02-01', to: '2026-02-28' })
})

test('overview returns a comparison for every KPI with semantic direction and unavailable denominator', async () => {
  const { createReportingService } = await import('./service.js')
  const repository = { async listOperationalOrders() { return [] }, async loadOverview(_id, query) {
    return query.from === '2026-08-01'
      ? { orders: [{ id: 'prior', status: 'Finalizado', total_cents: 500, table_tab_id: null }], payments: [], receipts: [], refunds: [] }
      : { orders: [{ id: 'now', status: 'Finalizado', total_cents: 1000, table_tab_id: null }], payments: [], receipts: [], refunds: [] }
  } }
  const result = await createReportingService(repository).overview('a', { from: '2026-09-01', to: '2026-09-25', period: 'current-month' })
  assert.equal(result.comparison.metrics.salesCents.previous, 500)
  assert.equal(result.comparison.metrics.salesCents.delta, 500)
  assert.equal(result.comparison.metrics.salesCents.percent, 100)
  assert.equal(result.comparison.metrics.salesCents.direction, 'higher_better')
  assert.equal(result.comparison.metrics.receivedCents.available, false)
  assert.equal(result.comparison.metrics.cancellationRate.direction, 'lower_better')
})
