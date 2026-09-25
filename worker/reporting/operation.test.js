import test from 'node:test'
import assert from 'node:assert/strict'

test('operation excludes cancelled and backdated orders and uses canonical durations', async () => {
  const { createReportingService } = await import('./service.js')
  const repository = { async listOperationalOrders() { return [
    { id: 'fast', status: 'Finalizado', is_backdated: 0, created_at: '2026-09-10T12:00:00.000Z', finished_at: '2026-09-10T12:20:00.000Z', scheduled_for: null, timing_policy_snapshot_json: null, type: 'Entrega' },
    { id: 'late', status: 'Finalizado', is_backdated: 0, created_at: '2026-09-10T12:00:00.000Z', finished_at: '2026-09-10T12:45:00.000Z', scheduled_for: null, timing_policy_snapshot_json: null, type: 'Retirada' },
    { id: 'cancelled', status: 'Cancelado', is_backdated: 0, created_at: '2026-09-10T12:00:00.000Z', finished_at: '2026-09-10T12:30:00.000Z', type: 'Entrega' },
    { id: 'backdated', status: 'Finalizado', is_backdated: 1, created_at: '2026-09-10T12:00:00.000Z', finished_at: '2026-09-10T12:30:00.000Z', type: 'Entrega' },
  ] } }
  const result = await createReportingService(repository).operation('business-a', { from: '2026-09-01', to: '2026-09-30' })
  assert.equal(result.data.averageDurationMinutes, 32.5)
  assert.equal(result.data.medianDurationMinutes, 32.5)
  assert.equal(result.data.p90DurationMinutes, 45)
  assert.equal(result.data.withinDeadlineRate, 50)
  assert.deepEqual(result.quality, { eligibleCount: 2, measuredCount: 2, legacyPolicyCount: 2, invalidCount: 0 })
})
