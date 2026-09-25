import test from 'node:test'
import assert from 'node:assert/strict'

import { KITCHEN_TV_NEAR_LIMIT_MINUTES, buildKitchenDisplayPresentation } from './kitchenDisplayPresentation.js'

const now = new Date('2026-09-22T15:00:00.000Z')
const timing = { scheduledPrepLeadMinutes: 50, scheduledLateGraceMinutes: 15, immediateLateAfterMinutes: 30, immediateVeryLateAfterMinutes: 60 }
const denseItems = (prefix = 'Produto') => Array.from({ length: 8 }, (_, index) => ({ quantity: 1, name: `${prefix} ${index + 1}`, note: '' }))
const preparing = (index, createdAt = '2026-09-22T14:50:00.000Z', items = []) => ({ id: `p-${String(index).padStart(2, '0')}`, orderNumber: index, status: 'Em preparo', type: 'Entrega', client: `Cliente ${index}`, createdAt, items })
const scheduled = (index, items = []) => ({ id: `s-${String(index).padStart(2, '0')}`, orderNumber: 100 + index, status: 'Em preparo', type: 'Retirada', client: `Agendado ${index}`, createdAt: '2026-09-22T12:00:00.000Z', scheduledFor: new Date(now.getTime() + (120 + index) * 60_000).toISOString(), items })

test('six-slot allocation covers 0-8 preparing with no scheduled orders', () => {
  for (let count = 0; count <= 8; count += 1) {
    const result = buildKitchenDisplayPresentation(Array.from({ length: count }, (_, index) => preparing(index)), timing, now)
    assert.equal(result.cards.length, Math.min(6, count), `preparing=${count}`)
    assert.equal(result.overflow, Math.max(0, count - 6), `preparing=${count}`)
    assert.equal(result.cards.every(({ phase }) => phase === 'preparing'), true)
    assert.equal(result.cards.every(({ slotCost }) => slotCost === 1), true)
  }
})

test('scheduled work reserves one slot and fills every free slot after up to five preparing', () => {
  for (let preparingCount = 0; preparingCount <= 8; preparingCount += 1) {
    for (const scheduledCount of [1, 4, 8]) {
      const orders = [
        ...Array.from({ length: preparingCount }, (_, index) => preparing(index)),
        ...Array.from({ length: scheduledCount }, (_, index) => scheduled(index)),
      ]
      const result = buildKitchenDisplayPresentation(orders, timing, now)
      const expectedPreparing = Math.min(5, preparingCount)
      const expectedScheduled = Math.min(scheduledCount, 6 - expectedPreparing)
      assert.equal(result.cards.filter(({ phase }) => phase === 'preparing').length, expectedPreparing)
      assert.equal(result.cards.filter(({ phase }) => phase === 'scheduled').length, expectedScheduled)
      assert.equal(result.cards.length, Math.min(6, expectedPreparing + scheduledCount))
      assert.equal(result.overflow, preparingCount + scheduledCount - result.cards.length)
      assert.equal(result.cards.at(-1)?.phase, expectedScheduled ? 'scheduled' : 'preparing')
    }
  }
})

test('a tall preparing card consumes two slots while the first scheduled card remains protected', () => {
  const orders = [
    preparing(1, undefined, denseItems('Grande')),
    preparing(2),
    preparing(3),
    preparing(4),
    preparing(5),
    scheduled(1),
  ]
  const result = buildKitchenDisplayPresentation(orders, timing, now)

  assert.deepEqual(result.cards.map(({ order }) => order.id), ['p-01', 'p-02', 'p-03', 'p-04', 's-01'])
  assert.deepEqual(result.cards.map(({ slotCost }) => slotCost), [2, 1, 1, 1, 1])
  assert.equal(result.cards.find(({ order }) => order.id === 'p-01')?.layoutDemand, 'tall')
  assert.equal(result.cards.at(-1)?.order.id, 's-01')
  assert.equal(result.overflow, 1)
})

test('a tall protected scheduled card displaces the lowest-priority preparing card instead of disappearing', () => {
  const orders = [
    preparing(1),
    preparing(2),
    preparing(3),
    preparing(4),
    preparing(5),
    scheduled(1, denseItems('Agendado grande')),
  ]
  const result = buildKitchenDisplayPresentation(orders, timing, now)

  assert.deepEqual(result.cards.map(({ order }) => order.id), ['p-01', 'p-02', 'p-03', 'p-04', 's-01'])
  assert.equal(result.cards.at(-1)?.slotCost, 2)
  assert.equal(result.cards.at(-1)?.layoutDemand, 'tall')
  assert.equal(result.overflow, 1)
})

test('additional scheduled cards fill free slots only when no higher-priority preparing candidate was blocked', () => {
  const fillable = buildKitchenDisplayPresentation([
    preparing(1, undefined, denseItems('Grande')),
    scheduled(1),
    scheduled(2),
    scheduled(3),
    scheduled(4),
  ], timing, now)

  assert.deepEqual(fillable.cards.map(({ order }) => order.id), ['p-01', 's-01', 's-02', 's-03', 's-04'])
  assert.equal(fillable.cards.reduce((sum, card) => sum + card.slotCost, 0), 6)
  assert.equal(fillable.overflow, 0)

  const blocked = buildKitchenDisplayPresentation([
    preparing(1),
    preparing(2),
    preparing(3),
    preparing(4),
    preparing(5, undefined, denseItems('Prioritário grande')),
    scheduled(1),
    scheduled(2),
  ], timing, now)

  assert.deepEqual(blocked.cards.map(({ order }) => order.id), ['p-01', 'p-02', 'p-03', 'p-04', 's-01'])
  assert.equal(blocked.cards.some(({ order }) => order.id === 's-02'), false)
  assert.equal(blocked.overflow, 2)
})

test('state precedence is new, late, near-limit, preparing, scheduled', () => {
  assert.equal(KITCHEN_TV_NEAR_LIMIT_MINUTES, 5)
  const orders = [
    preparing(1, '2026-09-22T14:29:00.000Z'),
    preparing(2, '2026-09-22T14:35:00.000Z'),
    preparing(3, '2026-09-22T14:40:00.000Z'),
    scheduled(1),
  ]
  const result = buildKitchenDisplayPresentation(orders, timing, now, new Set(['p-01', 'p-03', 's-01']))
  const states = Object.fromEntries(result.cards.map((entry) => [entry.order.id, entry.state]))
  assert.equal(states['p-01'], 'new')
  assert.equal(states['p-02'], 'near-limit')
  assert.equal(states['p-03'], 'new')
  assert.equal(states['s-01'], 'new')

  const unhighlighted = buildKitchenDisplayPresentation(orders, timing, now)
  const plainStates = Object.fromEntries(unhighlighted.cards.map((entry) => [entry.order.id, entry.state]))
  assert.equal(plainStates['p-01'], 'late')
  assert.equal(plainStates['p-02'], 'near-limit')
  assert.equal(plainStates['p-03'], 'preparing')
  assert.equal(plainStates['s-01'], 'scheduled')
})

test('header counters describe the complete queue rather than only visible cards', () => {
  const orders = [...Array.from({ length: 8 }, (_, index) => preparing(index)), scheduled(1), scheduled(2)]
  const result = buildKitchenDisplayPresentation(orders, timing, now)
  assert.deepEqual(result.counts, { preparing: 8, late: 0, scheduled: 2 })
  assert.equal(result.cards.length, 6)
  assert.equal(result.overflow, 4)
})
