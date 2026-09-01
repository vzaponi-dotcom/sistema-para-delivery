import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getElapsedMinutes,
  getFinalActionLabel,
  getOrderUrgency,
  isFinishedToday,
  isOrderFinished,
  normalizeOrder,
} from './orderWorkflow.js'

const now = new Date('2026-09-01T15:00:00.000Z')

const minutesAgo = (minutes) => new Date(now.getTime() - minutes * 60_000).toISOString()

test('normalizes legacy active statuses into Em preparo', () => {
  const normalized = normalizeOrder({ id: 1, status: 'Pendente', date: 'Hoje' }, now)

  assert.equal(normalized.status, 'Em preparo')
  assert.equal(normalized.finishedAt, null)
  assert.ok(normalized.createdAt)
})

test('normalizes legacy final statuses as finished', () => {
  const normalized = normalizeOrder({ id: 2, status: 'Entregue', date: 'Hoje' }, now)

  assert.equal(normalized.status, 'Finalizado')
  assert.ok(normalized.finishedAt)
  assert.equal(isOrderFinished(normalized), true)
})

test('calculates elapsed preparation minutes', () => {
  assert.equal(getElapsedMinutes({ createdAt: minutesAgo(12) }, now), 12)
})

test('classifies urgency using operational thresholds', () => {
  assert.equal(getOrderUrgency({ createdAt: minutesAgo(8) }, now), 'normal')
  assert.equal(getOrderUrgency({ createdAt: minutesAgo(20) }, now), 'attention')
  assert.equal(getOrderUrgency({ createdAt: minutesAgo(30) }, now), 'delayed')
})

test('uses delivery-specific final action label', () => {
  assert.equal(getFinalActionLabel({ type: 'Entrega' }), 'Saiu para entrega')
  assert.equal(getFinalActionLabel({ type: 'Retirada' }), 'Finalizar')
  assert.equal(getFinalActionLabel({ type: 'Local' }), 'Finalizar')
})

test('recognizes orders finished today', () => {
  assert.equal(isFinishedToday({ finishedAt: '2026-09-01T10:00:00.000Z' }, now), true)
  assert.equal(isFinishedToday({ finishedAt: '2026-08-31T23:59:59.000Z' }, now), false)
  assert.equal(isFinishedToday({ finishedAt: null }, now), false)
})
