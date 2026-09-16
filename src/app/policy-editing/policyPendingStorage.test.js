import assert from 'node:assert/strict'
import test from 'node:test'
import { clearPending, readPending, writePending } from './policyPendingStorage.js'

const memoryStorage = () => {
  const values = new Map()
  return {
    get length() { return values.size },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  }
}
const pointer = {
  resource: 'stationConfiguration', scopeId: 'station-1', mutationId: 'mutation-1', payloadHash: 'sha256-1',
  startedAt: '2026-09-13T10:00:00.000Z', contextId: 'context-1',
}

test('pending storage keeps only the minimal scoped pointer and can clear it', () => {
  const storage = memoryStorage()
  assert.deepEqual(writePending(storage, 'context-1', 'stationConfiguration:station-1', { ...pointer, token: 'secret', data: { private: true } }), { ok: true })
  assert.deepEqual(readPending(storage, 'context-1', 'stationConfiguration:station-1', new Date('2026-09-13T11:00:00.000Z')), { ...pointer, expired: false })
  assert.equal([...storage.values.values()][0].includes('secret'), false)
  assert.equal([...storage.values.values()][0].includes('private'), false)
  clearPending(storage, 'context-1', 'stationConfiguration:station-1')
  assert.equal(readPending(storage, 'context-1', 'stationConfiguration:station-1'), null)
})

test('pending pointer expires at the explicit 24-hour boundary without disappearing', () => {
  const storage = memoryStorage()
  writePending(storage, 'context-1', 'stationConfiguration:station-1', pointer)
  assert.equal(readPending(storage, 'context-1', 'stationConfiguration:station-1', new Date('2026-09-14T09:59:59.999Z')).expired, false)
  assert.equal(readPending(storage, 'context-1', 'stationConfiguration:station-1', new Date('2026-09-14T10:00:00.000Z')).expired, true)
})

test('malformed or cross-context pointers are ignored', () => {
  const storage = memoryStorage()
  storage.setItem('settings-pending:context-1:operations', '{bad')
  assert.equal(readPending(storage, 'context-1', 'operations'), null)
  writePending(storage, 'context-1', 'stationConfiguration:station-1', pointer)
  assert.equal(readPending(storage, 'context-2', 'stationConfiguration:station-1'), null)
})

test('unavailable storage reports failure without throwing or claiming persistence', () => {
  const storage = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }
  const written = writePending(storage, 'context-1', 'operations', { ...pointer, resource: 'operations', scopeId: undefined })
  assert.equal(written.ok, false)
  assert.match(written.error.message, /blocked/)
  assert.equal(readPending(storage, 'context-1', 'operations'), null)
  assert.equal(clearPending(storage, 'context-1', 'operations'), false)
})



test('recovers a legacy settings-pending pointer unchanged', () => {
  const storage = memoryStorage()
  storage.setItem('settings-pending:context-1:operations', JSON.stringify({
    resource: 'operations', mutationId: 'mutation-legacy', payloadHash: 'sha256-legacy',
    startedAt: '2026-09-13T10:00:00.000Z', contextId: 'context-1',
  }))

  assert.deepEqual(readPending(storage, 'context-1', 'operations', new Date('2026-09-13T11:00:00.000Z')), {
    resource: 'operations', mutationId: 'mutation-legacy', payloadHash: 'sha256-legacy',
    startedAt: '2026-09-13T10:00:00.000Z', contextId: 'context-1', expired: false,
  })
})
