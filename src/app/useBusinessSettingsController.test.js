import assert from 'node:assert/strict'
import test from 'node:test'
import { adminFixture, draftFixture } from '../test-support/settingsFixtures.js'
import { createBusinessSettingsController, useBusinessSettingsController } from './useBusinessSettingsController.js'

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}
const memoryStorage = () => {
  const values = new Map()
  return {
    get length() { return values.size }, key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key),
  }
}
const context = { businessId: 'business-1', generation: 1, settingsContextId: 'context-1', capabilities: ['operations.settings.manage'] }
const savedResource = { ...adminFixture, revision: 2, data: draftFixture }

test('editing is local and confirmed save uses revision plus one stable mutation id', async () => {
  const calls = []
  const controller = createBusinessSettingsController({
    context, storage: memoryStorage(), createMutationId: () => 'mutation-1',
    api: {
      getSettings: async () => adminFixture,
      putSettings: async (resource, input, scopeId) => { calls.push([resource, input, scopeId]); return { resource: savedResource, receipt: { mutationId: input.mutationId, committedRevision: 2 } } },
      getSettingsReceipt: async () => ({ status: 'unconfirmed' }),
    },
  })
  await controller.load('operations')
  controller.edit('operations', draftFixture)
  assert.equal(calls.length, 0)
  assert.equal(await controller.save('operations'), true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][1].expectedRevision, 1)
  assert.equal(calls[0][1].mutationId, 'mutation-1')
  assert.deepEqual(calls[0][1].data, draftFixture)
  assert.deepEqual(controller.getResources().operations.confirmed, savedResource)
})

test('unknown save remains blocked and receipt reconciliation reads without resending', async () => {
  let writes = 0
  let receipt = { status: 'unconfirmed' }
  let current = adminFixture
  const storage = memoryStorage()
  const controller = createBusinessSettingsController({
    context, storage, createMutationId: () => 'mutation-1',
    api: {
      getSettings: async () => current,
      putSettings: async () => { writes += 1; throw new TypeError('network lost') },
      getSettingsReceipt: async () => receipt,
    },
  })
  await controller.load('operations')
  controller.edit('operations', draftFixture)
  assert.equal(await controller.save('operations'), false)
  assert.equal(controller.getResources().operations.status, 'unconfirmed')
  assert.equal(await controller.save('operations'), false)
  assert.equal(await controller.reconcile('operations'), false)
  assert.equal(writes, 1)

  receipt = { status: 'confirmed', receipt: { mutationId: 'mutation-1', committedRevision: 2 } }
  current = { ...savedResource, revision: 3 }
  assert.equal(await controller.reconcile('operations'), true)
  assert.equal(controller.getResources().operations.confirmed.revision, 3)
  assert.equal(writes, 1)
})

test('same-session reload recovers the minimal pointer and confirmed receipt', async () => {
  const storage = memoryStorage()
  const first = createBusinessSettingsController({
    context, storage, createMutationId: () => 'mutation-1',
    api: { getSettings: async () => adminFixture, putSettings: async () => { throw new TypeError('lost') }, getSettingsReceipt: async () => ({ status: 'unconfirmed' }) },
  })
  await first.load('operations')
  first.edit('operations', draftFixture)
  await first.save('operations')

  const second = createBusinessSettingsController({
    context, storage,
    api: {
      getSettings: async () => savedResource,
      putSettings: async () => assert.fail('reload reconciliation must not resend'),
      getSettingsReceipt: async () => ({ status: 'confirmed', receipt: { mutationId: 'mutation-1', committedRevision: 2 } }),
    },
  })
  await second.load('operations')
  assert.equal(second.getResources().operations.status, 'unconfirmed')
  assert.equal(await second.reconcile('operations'), true)
  assert.deepEqual(second.getResources().operations.confirmed, savedResource)
})

test('resource keys isolate station scopes and allow unrelated saves concurrently', async () => {
  const writes = []
  const controller = createBusinessSettingsController({
    context, storage: memoryStorage(), createMutationId: () => `mutation-${writes.length + 1}`,
    api: {
      getSettings: async (resource, scopeId) => ({ ...adminFixture, resource, scopeId, data: { value: scopeId || resource } }),
      putSettings: async (resource, input, scopeId) => { writes.push(`${resource}:${scopeId || ''}`); return { resource: { ...adminFixture, resource, scopeId, revision: 2, data: input.data }, receipt: {} } },
      getSettingsReceipt: async () => ({ status: 'unconfirmed' }),
    },
  })
  await controller.load('stationConfiguration', 'station-a')
  await controller.load('stationConfiguration', 'station-b')
  controller.edit('stationConfiguration', { value: 'A2' }, 'station-a')
  controller.edit('stationConfiguration', { value: 'B2' }, 'station-b')
  assert.deepEqual(await Promise.all([
    controller.save('stationConfiguration', 'station-a'),
    controller.save('stationConfiguration', 'station-b'),
  ]), [true, true])
  assert.deepEqual(writes.sort(), ['stationConfiguration:station-a', 'stationConfiguration:station-b'])
})

test('revision conflict is conclusive but preserves base draft and submitted intent for T15', async () => {
  const error = Object.assign(new Error('changed elsewhere'), { status: 409, code: 'SETTINGS_REVISION_CONFLICT' })
  const controller = createBusinessSettingsController({
    context, storage: memoryStorage(), createMutationId: () => 'mutation-1',
    api: { getSettings: async () => adminFixture, putSettings: async () => { throw error }, getSettingsReceipt: async () => ({ status: 'unconfirmed' }) },
  })
  await controller.load('operations')
  controller.edit('operations', draftFixture)
  assert.equal(await controller.save('operations'), false)
  const state = controller.getResources().operations
  assert.equal(state.status, 'conflict')
  assert.deepEqual(state.base, adminFixture)
  assert.deepEqual(state.draft, draftFixture)
  assert.deepEqual(state.submitted.data, draftFixture)
})

test('a 24-hour pointer requires an explicit current read and is never replayed', async () => {
  const storage = memoryStorage()
  storage.setItem('settings-pending:context-1:operations', JSON.stringify({
    resource: 'operations', mutationId: 'old-mutation', payloadHash: 'old-hash',
    startedAt: '2026-09-12T10:00:00.000Z', contextId: 'context-1',
  }))
  let receiptReads = 0
  let writes = 0
  const controller = createBusinessSettingsController({
    context, storage, now: () => new Date('2026-09-13T10:00:00.000Z'),
    api: {
      getSettings: async () => adminFixture,
      putSettings: async () => { writes += 1 },
      getSettingsReceipt: async () => { receiptReads += 1; return { status: 'confirmed' } },
    },
  })
  await controller.load('operations')
  assert.equal(controller.getResources().operations.status, 'unconfirmed')
  assert.equal(controller.getResources().operations.submitted.expired, true)
  assert.equal(await controller.reconcile('operations'), false)
  assert.equal(controller.getResources().operations.status, 'ready')
  assert.equal(receiptReads, 0)
  assert.equal(writes, 0)
})

test('logout/reset invalidates late responses and clears session pointers', async () => {
  const save = deferred()
  const storage = memoryStorage()
  const controller = createBusinessSettingsController({
    context, storage, createMutationId: () => 'mutation-1',
    api: { getSettings: async () => adminFixture, putSettings: () => save.promise, getSettingsReceipt: async () => ({ status: 'unconfirmed' }) },
  })
  await controller.load('operations')
  controller.edit('operations', draftFixture)
  const pending = controller.save('operations')
  controller.reset()
  save.resolve({ resource: savedResource, receipt: {} })
  assert.equal(await pending, false)
  assert.deepEqual(controller.getResources(), {})
  assert.equal(storage.length, 0)
  assert.equal(typeof useBusinessSettingsController, 'function')
})
