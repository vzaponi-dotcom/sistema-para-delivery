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
  SCHEDULE_MAX_DAYS,
  validateOrderSchedule,
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


test('multiday schedule policy accepts delivery, pickup and local through the 90th business day', () => {
  const now = new Date('2026-09-04T13:00:00.000Z')
  assert.equal(SCHEDULE_MAX_DAYS, 90)

  for (const [type, orderDate, scheduledFor] of [
    ['Entrega', '2026-09-04', '2026-09-04T15:00:00.000Z'],
    ['Retirada', '2026-09-05', '2026-09-05T15:00:00.000Z'],
    ['Local', '2026-12-03', '2026-12-03T15:00:00.000Z'],
  ]) {
    assert.deepEqual(validateOrderSchedule({ type, orderDate, scheduledFor }, now), {
      ok: true,
      scheduledFor,
      daysAhead: type === 'Entrega' ? 0 : type === 'Retirada' ? 1 : 90,
    })
  }
})

test('multiday schedule policy rejects past, date mismatch and the 91st business day with stable reasons', () => {
  const now = new Date('2026-09-04T13:00:00.000Z')

  assert.deepEqual(validateOrderSchedule({
    type: 'Entrega',
    orderDate: '2026-09-04',
    scheduledFor: '2026-09-04T12:59:59.000Z',
  }, now), { ok: false, code: 'SCHEDULE_IN_PAST' })

  assert.deepEqual(validateOrderSchedule({
    type: 'Retirada',
    orderDate: '2026-09-05',
    scheduledFor: '2026-09-06T15:00:00.000Z',
  }, now), { ok: false, code: 'SCHEDULE_DATE_MISMATCH' })

  assert.deepEqual(validateOrderSchedule({
    type: 'Local',
    orderDate: '2026-12-04',
    scheduledFor: '2026-12-04T15:00:00.000Z',
  }, now), { ok: false, code: 'SCHEDULE_OUT_OF_RANGE' })
})

test('schedule horizon uses Sao Paulo calendar days instead of UTC date boundaries', () => {
  const now = new Date('2026-09-05T01:30:00.000Z') // 04/09 22:30 in Sao Paulo
  const scheduledFor = '2026-12-04T02:30:00.000Z' // 03/12 23:30 in Sao Paulo

  assert.deepEqual(validateOrderSchedule({
    type: 'Entrega',
    orderDate: '2026-12-03',
    scheduledFor,
  }, now), { ok: true, scheduledFor, daysAhead: 90 })
})

test('schedule policy rejects invalid timestamps and unsupported order type without throwing', () => {
  const now = new Date('2026-09-04T13:00:00.000Z')
  assert.deepEqual(validateOrderSchedule({
    type: 'Entrega', orderDate: '2026-09-04', scheduledFor: 'not-a-date',
  }, now), { ok: false, code: 'SCHEDULE_INVALID' })
  assert.deepEqual(validateOrderSchedule({
    type: 'Outro', orderDate: '2026-09-05', scheduledFor: '2026-09-05T15:00:00.000Z',
  }, now), { ok: false, code: 'SCHEDULE_TYPE_NOT_ALLOWED' })
})
