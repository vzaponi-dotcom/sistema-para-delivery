import test from 'node:test'
import assert from 'node:assert/strict'
import * as timing from './orderTiming.js'
import { LEGACY_TIMING } from './businessPolicies.js'
import { buildKitchenQueueModel, getOrderTimingState } from '../src/domains/orders/index.js'

const currentTiming = {
  scheduledPrepLeadMinutes: 20,
  scheduledLateGraceMinutes: 5,
  immediateLateAfterMinutes: 10,
  immediateVeryLateAfterMinutes: 15,
}

test('active orders use current timing while terminal and backdated orders preserve historical evidence', () => {
  const active = { status: 'Em preparo', createdAt: '2026-09-12T12:00:00.000Z' }
  assert.deepEqual(timing.selectOrderTimingPolicy(active, currentTiming), currentTiming)

  const snapshot = { ...LEGACY_TIMING, immediateLateAfterMinutes: 25, immediateVeryLateAfterMinutes: 35 }
  const historical = { ...active, status: 'Finalizado', finishedAt: '2026-09-12T12:30:00.000Z', timingPolicySnapshot: snapshot }
  assert.deepEqual(timing.selectOrderTimingPolicy(historical, currentTiming), snapshot)
  assert.deepEqual(timing.selectOrderTimingPolicy({ ...historical, timingPolicySnapshot: null }, currentTiming), LEGACY_TIMING)
  assert.deepEqual(timing.selectOrderTimingPolicy({ ...historical, isBackdated: true, timingPolicySnapshot: null }, currentTiming), LEGACY_TIMING)
})

test('invalid historical snapshot is distinguished from an absent legacy snapshot', () => {
  assert.throws(() => timing.selectOrderTimingPolicy({
    status: 'Cancelado',
    timingPolicySnapshot: { ...LEGACY_TIMING, immediateVeryLateAfterMinutes: 20 },
  }, currentTiming), { code: 'ORDER_TIMING_SNAPSHOT_INVALID' })
})

test('historical scheduled duration uses its snapshot while legacy history keeps 50 minutes', () => {
  const base = {
    status: 'Finalizado',
    createdAt: '2026-09-12T11:00:00.000Z',
    scheduledFor: '2026-09-12T13:00:00.000Z',
    finishedAt: '2026-09-12T13:30:00.000Z',
  }
  assert.equal(timing.getOperationalDurationMinutes({ ...base, timingPolicySnapshot: currentTiming }, LEGACY_TIMING), 50)
  assert.equal(timing.getOperationalDurationMinutes({ ...base, timingPolicySnapshot: null }, currentTiming), 80)
})

test('optional policy preserves strict immediate boundaries and legacy calls', () => {
  const order = { status: 'Em preparo', createdAt: '2026-09-12T12:00:00.000Z' }
  assert.equal(getOrderTimingState(order, new Date('2026-09-12T12:10:00.000Z'), currentTiming), 'on-time')
  assert.equal(getOrderTimingState(order, new Date('2026-09-12T12:10:59.999Z'), currentTiming), 'on-time')
  assert.equal(getOrderTimingState(order, new Date('2026-09-12T12:11:00.000Z'), currentTiming), 'late')
  assert.equal(getOrderTimingState(order, new Date('2026-09-12T12:15:00.000Z'), currentTiming), 'late')
  assert.equal(getOrderTimingState(order, new Date('2026-09-12T12:16:00.000Z'), currentTiming), 'very-late')
  assert.equal(getOrderTimingState(order, new Date('2026-09-12T12:30:00.000Z')), 'on-time')
  assert.equal(getOrderTimingState(order, new Date('2026-09-12T12:31:00.000Z')), 'late')
})

test('scheduled lead and grace use exact current-policy boundaries without changing rounding', () => {
  const order = {
    status: 'Em preparo',
    createdAt: '2026-09-12T11:00:00.000Z',
    scheduledFor: '2026-09-12T13:00:00.000Z',
  }
  assert.equal(timing.getOperationalStartAt(order, currentTiming).toISOString(), '2026-09-12T12:40:00.000Z')
  assert.equal(timing.isScheduledWaiting(order, new Date('2026-09-12T12:39:59.999Z'), currentTiming), true)
  assert.equal(timing.isScheduledWaiting(order, new Date('2026-09-12T12:40:00.000Z'), currentTiming), false)
  assert.equal(getOrderTimingState(order, new Date('2026-09-12T13:05:00.000Z'), currentTiming), 'on-time')
  assert.equal(getOrderTimingState(order, new Date('2026-09-12T13:05:00.001Z'), currentTiming), 'late')
  assert.equal(timing.getOperationalElapsedMinutes(order, new Date('2026-09-12T12:40:59.999Z'), currentTiming), 0)
})

test('kitchen queue reclassifies an existing active scheduled order from the current policy', () => {
  const order = {
    id: 'scheduled-1', status: 'Em preparo', type: 'Retirada', client: 'Cliente',
    createdAt: '2026-09-12T11:00:00.000Z', scheduledFor: '2026-09-12T13:00:00.000Z',
  }
  const now = new Date('2026-09-12T12:20:00.000Z')
  assert.equal(buildKitchenQueueModel([order], now, '', LEGACY_TIMING).scheduled.length, 0)
  assert.equal(buildKitchenQueueModel([order], now, '', currentTiming).scheduled.length, 1)
})
