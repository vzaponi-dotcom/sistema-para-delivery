import test from 'node:test'
import assert from 'node:assert/strict'
import { getNextKitchenTransitionAt, scheduleKitchenTransitions } from './kitchenClock.js'

const scheduledFixture = (id, operationalStartIso) => ({
  id,
  type: 'Entrega',
  status: 'Em preparo',
  createdAt: '2026-09-04T12:00:00.000Z',
  scheduledFor: new Date(Date.parse(operationalStartIso) + 50 * 60_000).toISOString(),
})

const createTwoBoundaryHarness = () => {
  let nowMs = Date.parse('2026-09-04T14:00:00.000Z')
  let nextId = 0
  const active = new Map()
  const delays = []
  const fired = []
  const cleared = []
  const orders = [
    scheduledFixture('first', '2026-09-04T14:10:00.000Z'),
    scheduledFixture('second', '2026-09-04T14:25:00.000Z'),
  ]
  const timers = {
    getNow: () => new Date(nowMs),
    setTimeout: (callback, delay) => {
      const id = ++nextId
      active.set(id, { callback, delay })
      delays.push(delay)
      assert.equal(active.size, 1)
      return id
    },
    clearTimeout: (id) => { cleared.push(id); active.delete(id) },
  }
  const runCurrent = () => {
    const [id, timer] = active.entries().next().value
    active.delete(id)
    nowMs += timer.delay
    timer.callback()
  }
  const onBoundary = (boundary) => fired.push(boundary.toISOString())
  return { active, cleared, delays, fired, onBoundary, orders, runCurrent, timers }
}

test('rearms consecutive operational boundaries with one exact timeout', () => {
  const harness = createTwoBoundaryHarness()
  const sameOrdersReference = harness.orders
  assert.equal(
    getNextKitchenTransitionAt(harness.orders, harness.timers.getNow()).toISOString(),
    '2026-09-04T14:10:00.000Z',
  )
  const cleanup = scheduleKitchenTransitions(harness.orders, harness.onBoundary, harness.timers)
  assert.equal(harness.orders, sameOrdersReference)
  assert.deepEqual(harness.delays, [10 * 60_000])

  harness.runCurrent()
  assert.deepEqual(harness.fired, ['2026-09-04T14:10:00.000Z'])
  assert.deepEqual(harness.delays, [10 * 60_000, 15 * 60_000])
  assert.equal(harness.active.size, 1)

  harness.runCurrent()
  assert.deepEqual(harness.fired, ['2026-09-04T14:10:00.000Z', '2026-09-04T14:25:00.000Z'])
  assert.equal(harness.active.size, 0)

  cleanup()
  assert.equal(harness.active.size, 0)
})

test('cleanup cancels the currently rearmed timeout', () => {
  const harness = createTwoBoundaryHarness()
  const cleanup = scheduleKitchenTransitions(harness.orders, harness.onBoundary, harness.timers)
  harness.runCurrent()
  assert.equal(harness.active.size, 1)
  const currentId = [...harness.active.keys()][0]
  cleanup()
  assert.deepEqual(harness.cleared, [currentId])
  assert.equal(harness.active.size, 0)
})
