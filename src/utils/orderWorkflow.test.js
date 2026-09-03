import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatCancellationDate,
  formatOrderDate,
  formatOrderTime,
  getElapsedMinutes,
  getFinalActionLabel,
  getOrderTimingState,
  getOrderUrgency,
  isFinishedToday,
  isOrderFinished,
  normalizeOrder,
  normalizeOrderDate,
  toLocalDateValue,
} from './orderWorkflow.js'

const now = new Date(2026, 8, 1, 12, 0, 0)
const minutesAgo = (minutes) => new Date(now.getTime() - minutes * 60_000).toISOString()

test('normalizes legacy active statuses into Em preparo', () => {
  const normalized = normalizeOrder({ id: 1, status: 'Pendente', date: 'Hoje' }, now)
  assert.equal(normalized.status, 'Em preparo'); assert.equal(normalized.finishedAt, null); assert.ok(normalized.createdAt)
})
test('normalizes legacy final statuses as finished', () => { const normalized = normalizeOrder({ id: 2, status: 'Entregue', date: 'Hoje' }, now); assert.equal(normalized.status, 'Finalizado'); assert.ok(normalized.finishedAt); assert.equal(isOrderFinished(normalized), true) })
test('calculates elapsed preparation minutes', () => { assert.equal(getElapsedMinutes({ createdAt: minutesAgo(12) }, now), 12) })
test('classifies urgency using operational thresholds', () => { assert.equal(getOrderUrgency({ createdAt: minutesAgo(30) }, now), 'normal'); assert.equal(getOrderUrgency({ createdAt: minutesAgo(31) }, now), 'attention'); assert.equal(getOrderUrgency({ createdAt: minutesAgo(40) }, now), 'attention'); assert.equal(getOrderUrgency({ createdAt: minutesAgo(41) }, now), 'delayed') })
test('classifies live timing after 30 and 40 minutes', () => { assert.equal(getOrderTimingState({ createdAt: minutesAgo(30) }, now), 'on-time'); assert.equal(getOrderTimingState({ createdAt: minutesAgo(31) }, now), 'late'); assert.equal(getOrderTimingState({ createdAt: minutesAgo(40) }, now), 'late'); assert.equal(getOrderTimingState({ createdAt: minutesAgo(41) }, now), 'very-late') })
test('formats the automatic order creation time', () => { const createdAt = new Date(2026, 8, 1, 11, 42, 0).toISOString(); assert.equal(formatOrderTime(createdAt), '11:42'); assert.equal(formatOrderTime('invalid'), '') })
test('uses delivery-specific final action label', () => { assert.equal(getFinalActionLabel({ type: 'Entrega' }), 'Saiu para entrega'); assert.equal(getFinalActionLabel({ type: 'Retirada' }), 'Finalizar'); assert.equal(getFinalActionLabel({ type: 'Local' }), 'Finalizar') })
test('recognizes orders finished today', () => { const todayAtTen = new Date(2026, 8, 1, 10, 0, 0).toISOString(); const yesterdayLate = new Date(2026, 7, 31, 23, 59, 59).toISOString(); assert.equal(isFinishedToday({ finishedAt: todayAtTen }, now), true); assert.equal(isFinishedToday({ finishedAt: yesterdayLate }, now), false); assert.equal(isFinishedToday({ finishedAt: null }, now), false) })
test('formats local dates for form values and display', () => { assert.equal(toLocalDateValue(now), '2026-09-01'); assert.equal(formatOrderDate('2026-09-01'), '01/09/2026') })
test('migrates legacy Hoje and Ontem labels to orderDate', () => { assert.equal(normalizeOrder({ id: 3, date: 'Hoje' }, now).orderDate, '2026-09-01'); assert.equal(normalizeOrder({ id: 4, date: 'Ontem' }, now).orderDate, '2026-08-31') })
test('preserves valid previous order dates and rejects future dates', () => { assert.equal(normalizeOrderDate('2026-08-28', now), '2026-08-28'); assert.equal(normalizeOrderDate('2026-09-03', now), '2026-09-01'); assert.equal(normalizeOrderDate('', now), '2026-09-01') })

test('formats only the official cancellation timestamp and never invents one for legacy rows', () => {
  assert.equal(formatCancellationDate(null), 'Data não informada')
  assert.equal(formatCancellationDate(''), 'Data não informada')
  assert.equal(formatCancellationDate('invalid'), 'Data não informada')
  assert.match(formatCancellationDate('2026-09-03T15:30:00-03:00'), /^03\/09\/2026/)
})
