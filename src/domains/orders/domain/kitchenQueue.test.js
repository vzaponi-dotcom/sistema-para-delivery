import test from 'node:test'
import assert from 'node:assert/strict'
import { buildKitchenQueueModel } from './kitchenQueue.js'

const now = new Date('2026-09-04T11:01:00.000Z')
const ids = (entries) => entries.map(({ order }) => order.id)

const scheduledOrder = {
  id: 'scheduled-1',
  status: 'Em preparo',
  type: 'Entrega',
  createdAt: '2026-09-04T08:00:00.000Z',
  scheduledFor: '2026-09-04T15:00:00.000Z',
}

const fixtures = [
  { id: 'old-operational', status: 'Em preparo', type: 'Retirada', createdAt: '2026-09-04T08:00:00.000Z', scheduledFor: '2026-09-04T11:00:00.000Z', items: [{ name: 'Marmita' }] },
  { id: 'order-1048', status: 'Em preparo', client: 'João Silva', type: 'Entrega', createdAt: '2026-09-04T10:30:00.000Z', items: [{ name: 'Pudim' }] },
  { id: 'desired-1230', status: 'Em preparo', type: 'Retirada', createdAt: '2026-09-04T08:00:00.000Z', scheduledFor: '2026-09-04T12:30:00.000Z' },
  { id: 'desired-1200', status: 'Em preparo', type: 'Entrega', createdAt: '2026-09-04T08:00:00.000Z', scheduledFor: '2026-09-04T12:00:00.000Z' },
  { id: 'finished-order', status: 'Finalizado', type: 'Local', createdAt: '2026-09-04T09:00:00.000Z', finishedAt: '2026-09-04T10:45:00.000Z' },
  { id: 'cancelled-order', status: 'Cancelado', type: 'Local', createdAt: '2026-09-04T09:00:00.000Z' },
]

test('each active order belongs to exactly one main queue at the boundary', () => {
  const before = new Date('2026-09-04T14:09:59.999Z')
  const atStart = new Date('2026-09-04T14:10:00.000Z')

  assert.deepEqual(ids(buildKitchenQueueModel([scheduledOrder], before, '').scheduled), ['scheduled-1'])
  assert.deepEqual(ids(buildKitchenQueueModel([scheduledOrder], before, '').preparing), [])
  assert.deepEqual(ids(buildKitchenQueueModel([scheduledOrder], atStart, '').scheduled), [])
  assert.deepEqual(ids(buildKitchenQueueModel([scheduledOrder], atStart, '').preparing), ['scheduled-1'])
})

test('late is an additional flag and never creates a third queue', () => {
  const lateImmediate = { id: 'late-immediate', status: 'Em preparo', type: 'Local', createdAt: '2026-09-04T14:40:00.000Z' }
  const lateScheduled = { id: 'late-scheduled', status: 'Em preparo', type: 'Entrega', createdAt: '2026-09-04T13:00:00.000Z', scheduledFor: '2026-09-04T15:00:00.000Z' }
  const model = buildKitchenQueueModel([lateImmediate, lateScheduled], new Date('2026-09-04T15:16:00.000Z'), '')

  assert.equal(model.preparing.length, 2)
  assert.equal(model.counts.late, 2)
  assert.equal(Object.hasOwn(model, 'late'), false)
})

test('keeps stable identifier tie-breakers and desired-time ordering for scheduled queue', () => {
  const model = buildKitchenQueueModel([
    { id: 'preparing-b', status: 'Em preparo', type: 'Local', createdAt: '2026-09-04T09:00:00.000Z' },
    { id: 'preparing-a', status: 'Em preparo', type: 'Local', createdAt: '2026-09-04T09:00:00.000Z' },
    { id: 'scheduled-b', status: 'Em preparo', type: 'Entrega', createdAt: '2026-09-04T08:00:00.000Z', scheduledFor: '2026-09-04T12:30:00.000Z' },
    { id: 'scheduled-a', status: 'Em preparo', type: 'Entrega', createdAt: '2026-09-04T08:00:00.000Z', scheduledFor: '2026-09-04T12:30:00.000Z' },
    { id: 'scheduled-first', status: 'Em preparo', type: 'Entrega', createdAt: '2026-09-04T08:00:00.000Z', scheduledFor: '2026-09-04T12:00:00.000Z' },
  ], now, '')

  assert.deepEqual(ids(model.preparing), ['preparing-a', 'preparing-b'])
  assert.deepEqual(ids(model.scheduled), ['scheduled-first', 'scheduled-a', 'scheduled-b'])
})

test('prioritizes the most overdue deadline even when its operational start is newer', () => {
  const model = buildKitchenQueueModel([
    {
      id: 'scheduled-25-late',
      status: 'Em preparo',
      type: 'Entrega',
      createdAt: '2026-09-04T12:00:00.000Z',
      scheduledFor: '2026-09-04T14:50:00.000Z',
    },
    {
      id: 'immediate-40-late',
      status: 'Em preparo',
      type: 'Local',
      createdAt: '2026-09-04T14:20:00.000Z',
    },
  ], new Date('2026-09-04T15:30:00.000Z'), '')

  assert.deepEqual(ids(model.preparing), ['immediate-40-late', 'scheduled-25-late'])
})

test('places overdue orders before orders that are still within deadline', () => {
  const model = buildKitchenQueueModel([
    {
      id: 'scheduled-on-time',
      status: 'Em preparo',
      type: 'Entrega',
      createdAt: '2026-09-04T12:00:00.000Z',
      scheduledFor: '2026-09-04T14:50:00.000Z',
    },
    {
      id: 'immediate-late',
      status: 'Em preparo',
      type: 'Local',
      createdAt: '2026-09-04T14:20:00.000Z',
    },
  ], new Date('2026-09-04T15:00:00.000Z'), '')

  assert.deepEqual(ids(model.preparing), ['immediate-late', 'scheduled-on-time'])
})

test('among on-time orders, places the nearest deadline first', () => {
  const model = buildKitchenQueueModel([
    {
      id: 'scheduled-later-deadline',
      status: 'Em preparo',
      type: 'Entrega',
      createdAt: '2026-09-04T12:00:00.000Z',
      scheduledFor: '2026-09-04T14:50:00.000Z',
    },
    {
      id: 'immediate-earlier-deadline',
      status: 'Em preparo',
      type: 'Local',
      createdAt: '2026-09-04T14:20:00.000Z',
    },
  ], new Date('2026-09-04T14:40:00.000Z'), '')

  assert.deepEqual(ids(model.preparing), ['immediate-earlier-deadline', 'scheduled-later-deadline'])
})

test('excludes final and cancelled orders from active queues', () => {
  const model = buildKitchenQueueModel(fixtures, now, '')

  assert.deepEqual(ids(model.allActive), ['old-operational', 'order-1048', 'desired-1230', 'desired-1200'])
  assert.equal(model.totalVisible, 4)
})

test('search filters visible queues without changing global indicators', () => {
  const globalModel = buildKitchenQueueModel(fixtures, now, '')
  const searchModel = buildKitchenQueueModel(fixtures, now, 'pudim')

  assert.deepEqual(ids(globalModel.preparing), ['order-1048', 'old-operational'])
  assert.deepEqual(ids(globalModel.scheduled), ['desired-1200', 'desired-1230'])
  assert.deepEqual(ids(searchModel.preparing), ['order-1048'])
  assert.deepEqual(ids(searchModel.scheduled), [])
  assert.equal(searchModel.totalVisible, 1)
  assert.deepEqual(searchModel.counts, globalModel.counts)
  assert.deepEqual(globalModel.counts, { preparing: 2, scheduled: 2, late: 1, finishedToday: 1 })
})

test('searches client, full order ID, last four digits, products and attendance type without changing order', () => {
  assert.deepEqual(ids(buildKitchenQueueModel(fixtures, now, 'joão').preparing), ['order-1048'])
  assert.deepEqual(ids(buildKitchenQueueModel(fixtures, now, 'order-1048').preparing), ['order-1048'])
  assert.deepEqual(ids(buildKitchenQueueModel(fixtures, now, '1048').preparing), ['order-1048'])
  assert.deepEqual(ids(buildKitchenQueueModel(fixtures, now, 'pudim').preparing), ['order-1048'])
  assert.deepEqual(ids(buildKitchenQueueModel(fixtures, now, 'entrega').preparing), ['order-1048'])
})
