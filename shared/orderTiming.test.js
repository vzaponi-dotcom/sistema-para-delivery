import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SCHEDULED_PREP_LEAD_MINUTES,
  SCHEDULED_LATE_GRACE_MINUTES,
  businessDateTimeToIso,
  getOperationalStartAt,
  getOperationalDurationMinutes,
  getOrderLateAt,
  getOrderMinutesLate,
  isFutureSameDaySchedule,
} from './orderTiming.js'

test('aplica janela 50 e tolerância 15', () => {
  assert.equal(SCHEDULED_PREP_LEAD_MINUTES, 50)
  assert.equal(SCHEDULED_LATE_GRACE_MINUTES, 15)
})

test('12:00 São Paulo vira 15:00Z', () => {
  assert.equal(businessDateTimeToIso('2026-09-04', '12:00'), '2026-09-04T15:00:00.000Z')
})

test('09:00 criado para 12:00 começa 11:10', () => {
  const order = { createdAt: '2026-09-04T12:00:00.000Z', scheduledFor: '2026-09-04T15:00:00.000Z' }
  assert.equal(getOperationalStartAt(order).toISOString(), '2026-09-04T14:10:00.000Z')
})

test('criado 11:45 para 12:00 começa 11:45', () => {
  const order = { createdAt: '2026-09-04T14:45:00.000Z', scheduledFor: '2026-09-04T15:00:00.000Z' }
  assert.equal(getOperationalStartAt(order).toISOString(), '2026-09-04T14:45:00.000Z')
})

test('pedido imediato usa início operacional + 30 min como prazo canônico', () => {
  const order = { createdAt: '2026-09-04T14:00:00.000Z' }
  assert.equal(getOrderLateAt(order).toISOString(), '2026-09-04T14:30:00.000Z')
})

test('pedido agendado usa horário desejado + 15 min como prazo canônico', () => {
  const order = { createdAt: '2026-09-04T12:00:00.000Z', scheduledFor: '2026-09-04T15:00:00.000Z' }
  assert.equal(getOrderLateAt(order).toISOString(), '2026-09-04T15:15:00.000Z')
})

test('minutos de atraso usam sempre o mesmo prazo e crescem continuamente', () => {
  const order = { createdAt: '2026-09-04T14:00:00.000Z' }
  assert.equal(getOrderMinutesLate(order, new Date('2026-09-04T14:39:00.000Z')), 9)
  assert.equal(getOrderMinutesLate(order, new Date('2026-09-04T14:40:00.000Z')), 10)
  assert.equal(getOrderMinutesLate(order, new Date('2026-09-04T14:41:00.000Z')), 11)
})

test('minutos de atraso nunca ficam negativos antes do prazo', () => {
  const order = { createdAt: '2026-09-04T14:00:00.000Z' }
  assert.equal(getOrderMinutesLate(order, new Date('2026-09-04T14:20:00.000Z')), 0)
})

test('duração negativa é inválida', () => {
  assert.equal(getOperationalDurationMinutes({ createdAt: '2026-09-04T15:00:00Z', finishedAt: '2026-09-04T14:59:00Z' }), null)
})

test('rejeita agendamento quando orderDate não é o dia operacional atual', () => {
  assert.equal(isFutureSameDaySchedule({
    type: 'Entrega',
    orderDate: '2026-09-03',
    scheduledFor: '2026-09-04T15:00:00.000Z',
  }, new Date('2026-09-04T13:00:00.000Z')), false)
})
