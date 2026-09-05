import test from 'node:test'
import assert from 'node:assert/strict'
import { detectOperationalArrivals, getNewOperationalOrderIds, operationalOrderIdSet } from './orderRealtime.js'

const scheduled = {
  id: 'scheduled-1', type: 'Entrega', status: 'Em preparo', createdAt: '2026-09-04T12:00:00.000Z',
  scheduledFor: '2026-09-04T15:00:00.000Z',
}

test('scheduled order outside operational window is excluded and alerts once at entry', () => {
  const before = operationalOrderIdSet([scheduled], new Date('2026-09-04T14:09:00Z'))
  assert.equal(before.has('scheduled-1'), false)
  assert.deepEqual(getNewOperationalOrderIds(before, [scheduled], new Date('2026-09-04T14:10:00Z')), ['scheduled-1'])
  assert.deepEqual(getNewOperationalOrderIds(new Set(['scheduled-1']), [scheduled], new Date('2026-09-04T14:11:00Z')), [])
})

test('Agora orders remain operational and cancelled orders stay excluded', () => {
  const now = new Date('2026-09-04T14:00:00Z')
  assert.deepEqual([...operationalOrderIdSet([{ id: 'now-1', status: 'Em preparo', createdAt: '2026-09-04T13:00:00Z' }], now)], ['now-1'])
  assert.deepEqual([...operationalOrderIdSet([{ id: 'cancelled-1', status: 'Cancelado', createdAt: '2026-09-04T13:00:00Z' }], now)], [])
})

test('scheduled arrival appears at the exact boundary and alerts only once', () => {
  const oneMillisecondBefore = new Date('2026-09-04T14:09:59.999Z')
  const atBoundary = new Date('2026-09-04T14:10:00.000Z')
  const before = detectOperationalArrivals(new Set(), [scheduled], oneMillisecondBefore, new Set())
  assert.deepEqual([...before.currentIds], [])
  assert.deepEqual(before.newIds, [])

  const arrival = detectOperationalArrivals(before.currentIds, [scheduled], atBoundary, new Set())
  assert.deepEqual([...arrival.currentIds], ['scheduled-1'])
  assert.deepEqual(arrival.newIds, ['scheduled-1'])

  const later = detectOperationalArrivals(arrival.currentIds, [scheduled], new Date('2026-09-04T14:11:00.000Z'), new Set(['scheduled-1']))
  assert.deepEqual([...later.currentIds], ['scheduled-1'])
  assert.deepEqual(later.newIds, [])
})

test('initialization after the boundary seeds current IDs without retroactive alerts', () => {
  const initialized = detectOperationalArrivals(undefined, [scheduled], new Date('2026-09-04T14:11:00.000Z'), new Set())
  assert.deepEqual([...initialized.currentIds], ['scheduled-1'])
  assert.deepEqual(initialized.newIds, [])
})
