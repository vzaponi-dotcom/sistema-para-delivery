import assert from 'node:assert/strict'
import test from 'node:test'
import {
  KITCHEN_TV_TELEMETRY_FRESH_MS,
  isKitchenTvTelemetryFresh,
  kitchenTvVisibility,
} from './kitchenTvControlPresentation.js'

const NOW = new Date('2026-09-28T21:10:10.000Z')

test('telemetry freshness uses one shared admin threshold with an exact boundary', () => {
  assert.equal(KITCHEN_TV_TELEMETRY_FRESH_MS, 10_000)
  assert.equal(isKitchenTvTelemetryFresh({ reportedAt: '2026-09-28T21:10:00.000Z' }, NOW), true)
  assert.equal(isKitchenTvTelemetryFresh({ reportedAt: '2026-09-28T21:09:59.999Z' }, NOW), false)
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
