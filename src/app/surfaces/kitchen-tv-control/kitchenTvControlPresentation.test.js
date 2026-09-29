import assert from 'node:assert/strict'
import test from 'node:test'
import {
  KITCHEN_TV_CLOCK_SKEW_MS,
  KITCHEN_TV_TELEMETRY_FRESH_MS,
  isKitchenTvTelemetryFresh,
  kitchenTvOperationalStatus,
  kitchenTvVisibility,
} from './kitchenTvControlPresentation.js'

const NOW = new Date('2026-09-28T21:10:10.000Z')

test('telemetry freshness tolerates heartbeat jitter and bounded clock skew', () => {
  assert.equal(KITCHEN_TV_TELEMETRY_FRESH_MS, 15_000)
  assert.equal(KITCHEN_TV_CLOCK_SKEW_MS, 5_000)
  assert.equal(isKitchenTvTelemetryFresh({ reportedAt: '2026-09-28T21:09:55.000Z' }, NOW), true)
  assert.equal(isKitchenTvTelemetryFresh({ reportedAt: '2026-09-28T21:09:54.999Z' }, NOW), false)
  assert.equal(isKitchenTvTelemetryFresh({ reportedAt: '2026-09-28T21:10:14.999Z' }, NOW), true)
  assert.equal(isKitchenTvTelemetryFresh({ reportedAt: '2026-09-28T21:10:15.001Z' }, NOW), false)
  assert.equal(isKitchenTvTelemetryFresh(null, NOW), false)
})

test('stale telemetry never claims Na TV or Fora while hidden remains authoritative', () => {
  const telemetry = { visibleOrderIds: ['visible'], reportedAt: '2026-09-28T21:09:59.999Z' }
  assert.deepEqual(kitchenTvVisibility({
    orderId: 'visible',
    hiddenOrderIds: [],
    telemetry,
    telemetryFresh: false,
  }), { key: 'unknown', label: 'TV sem sinal' })
  assert.deepEqual(kitchenTvVisibility({
    orderId: 'hidden',
    hiddenOrderIds: ['hidden'],
    telemetry,
    telemetryFresh: false,
  }), { key: 'hidden', label: 'Retirado' })
})


test('scheduled visible orders use the scheduled operational state before late/near-limit decoration', () => {
  assert.deepEqual(kitchenTvOperationalStatus({
    phase: 'scheduled',
    timingState: 'on-time',
    lateAt: new Date('2026-09-28T21:10:12.000Z'),
  }, NOW), { key: 'scheduled', label: 'AGENDADO' })
})
