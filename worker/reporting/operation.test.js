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

test('operation exposes distribution, deadline, punctuality and coverage from canonical timing', async () => {
  const { createReportingService } = await import('./service.js')
  const repository = { async listOperationalOrders() { return [
    { id: 'immediate', order_date: '2026-09-10', status: 'Finalizado', is_backdated: 0, created_at: '2026-09-10T02:30:00.000Z', finished_at: '2026-09-10T02:50:00.000Z', type: 'Entrega' },
    { id: 'scheduled', order_date: '2026-09-10', status: 'Entregue', is_backdated: 0, created_at: '2026-09-10T13:00:00.000Z', scheduled_for: '2026-09-10T14:00:00.000Z', finished_at: '2026-09-10T14:20:00.000Z', type: 'Retirada' },
    { id: 'invalid', order_date: '2026-09-10', status: 'Despachado', is_backdated: 0, created_at: 'bad', finished_at: '2026-09-10T14:00:00.000Z', type: 'Entrega' },
    { id: 'active', order_date: '2026-09-10', status: 'Em preparo', is_backdated: 0, created_at: '2026-09-10T12:00:00.000Z', type: 'Entrega' },
  ] } }
  const result = await createReportingService(repository).operation('a', { from: '2026-09-10', to: '2026-09-10' })
  assert.equal(result.quality.eligibleCount, 3)
  assert.equal(result.quality.measuredCount, 2)
  assert.equal(result.quality.invalidCount, 1)
  assert.equal(result.data.operationalOrdersCount, 3)
  assert.equal(result.data.withinDeadlineCount, 1)
  assert.equal(result.data.outsideDeadlineCount, 1)
  assert.equal(result.data.fastestMinutes, 20)
  assert.equal(result.data.slowestMinutes, 70)
  assert.equal(result.data.scheduledPunctualityRate, 0)
  assert.equal(result.data.byHour.find((row) => row.hour === 23).count, 1)
  assert.equal(result.data.byModality.find((row) => row.type === 'Retirada').count, 1)
  assert.equal(result.data.durationBands.reduce((total, row) => total + row.count, 0), 2)
  assert.ok(result.warnings.length > 0)
})

test('terminal policy snapshot is historical and malformed snapshots fail explicitly', async () => {
  const { createReportingService } = await import('./service.js')
  const base = { status: 'Finalizado', is_backdated: 0, created_at: '2026-09-10T12:00:00Z', finished_at: '2026-09-10T12:15:00Z', type: 'Entrega' }
  const policy = JSON.stringify({ scheduledPrepLeadMinutes: 50, scheduledLateGraceMinutes: 15, immediateLateAfterMinutes: 10, immediateVeryLateAfterMinutes: 20 })
  const repository = { async listOperationalOrders() { return [{ ...base, id: 'snapshot', timing_policy_snapshot_json: policy }, { ...base, id: 'legacy', timing_policy_snapshot_json: null }] } }
  const result = await createReportingService(repository).operation('a', { from: '2026-09-10', to: '2026-09-10' })
  assert.equal(result.data.withinDeadlineCount, 1)
  assert.equal(result.data.outsideDeadlineCount, 1)
  assert.equal(result.quality.legacyPolicyCount, 1)
  const corrupt = { async listOperationalOrders() { return [{ ...base, id: 'bad', timing_policy_snapshot_json: '{' }] } }
  await assert.rejects(createReportingService(corrupt).operation('a', { from: '2026-09-10', to: '2026-09-10' }), { code: 'ORDER_TIMING_SNAPSHOT_INVALID' })
})
