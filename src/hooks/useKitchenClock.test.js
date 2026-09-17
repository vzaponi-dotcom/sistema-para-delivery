import test from 'node:test'
import assert from 'node:assert/strict'
import { detectOperationalArrivals } from '../utils/orderRealtime.js'
import { getKitchenNowForRender, startKitchenClock } from './useKitchenClock.js'

const scheduled = {
  id: 'scheduled-1',
  type: 'Entrega',
  status: 'Em preparo',
  createdAt: '2026-09-04T12:00:00.000Z',
  scheduledFor: '2026-09-04T15:00:00.000Z',
}

const createEventTarget = () => {
  const listeners = new Map()
  return {
    listeners,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name, callback) => {
      if (listeners.get(name) === callback) listeners.delete(name)
    },
  }
}

test('activation renders current time and seeds crossed orders without a retroactive alert', () => {
  const storedAtMount = new Date('2026-09-04T14:00:00.000Z')
  let currentMs = Date.parse('2026-09-04T14:20:00.000Z')
  const getNow = () => new Date(currentMs)

  assert.equal(getKitchenNowForRender(storedAtMount, false, getNow), storedAtMount)
  const firstActivationNow = getKitchenNowForRender(storedAtMount, true, getNow)
  assert.equal(firstActivationNow.toISOString(), '2026-09-04T14:20:00.000Z')
  const firstEntry = detectOperationalArrivals(undefined, [scheduled], firstActivationNow, new Set())
  assert.deepEqual([...firstEntry.currentIds], ['scheduled-1'])
  assert.deepEqual(firstEntry.newIds, [])

  currentMs = Date.parse('2026-09-04T14:30:00.000Z')
  const inactiveNow = getKitchenNowForRender(firstActivationNow, false, getNow)
  assert.equal(inactiveNow, firstActivationNow)
  currentMs = Date.parse('2026-09-04T14:35:00.000Z')
  const reentryNow = getKitchenNowForRender(inactiveNow, true, getNow)
  assert.equal(reentryNow.toISOString(), '2026-09-04T14:35:00.000Z')
})

test('each active lifecycle publishes current time and cleans exact and fallback resources', () => {
  let currentMs = Date.parse('2026-09-04T14:20:00.000Z')
  let intervalCallback = null
  let exactCleanupCount = 0
  let intervalCleanupCount = 0
  const published = []
  const documentTarget = { ...createEventTarget(), visibilityState: 'visible' }
  const windowTarget = createEventTarget()
  const dependencies = {
    getNow: () => new Date(currentMs),
    scheduleTransitions: (orders, onBoundary) => {
      assert.equal(orders[0], scheduled)
      assert.equal(typeof onBoundary, 'function')
      return () => { exactCleanupCount += 1 }
    },
    setInterval: (callback, delay) => {
      assert.equal(delay, 60_000)
      intervalCallback = callback
      return 41
    },
    clearInterval: (id) => {
      assert.equal(id, 41)
      intervalCleanupCount += 1
    },
    documentTarget,
    windowTarget,
  }

  const stopFirstEntry = startKitchenClock([scheduled], (now) => published.push(now.toISOString()), dependencies)
  assert.deepEqual(published, ['2026-09-04T14:20:00.000Z'])
  currentMs = Date.parse('2026-09-04T14:21:00.000Z')
  intervalCallback()
  assert.deepEqual(published, ['2026-09-04T14:20:00.000Z', '2026-09-04T14:21:00.000Z'])
  stopFirstEntry()
  assert.equal(exactCleanupCount, 1)
  assert.equal(intervalCleanupCount, 1)
  assert.equal(documentTarget.listeners.size, 0)
  assert.equal(windowTarget.listeners.size, 0)

  currentMs = Date.parse('2026-09-04T14:35:00.000Z')
  const stopReentry = startKitchenClock([scheduled], (now) => published.push(now.toISOString()), dependencies)
  assert.equal(published.at(-1), '2026-09-04T14:35:00.000Z')
  stopReentry()
  assert.equal(exactCleanupCount, 2)
  assert.equal(intervalCleanupCount, 2)
})
