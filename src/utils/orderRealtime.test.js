import test from 'node:test'
import assert from 'node:assert/strict'
import { getNewOperationalOrderIds, operationalOrderIdSet } from './orderRealtime.js'

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
