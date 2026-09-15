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

test('two immediate saves reserve one resource before hashing and issue at most one PUT', async () => {
  const write = deferred()
  let writes = 0
  let mutation = 0
  const controller = createBusinessSettingsController({
    context, storage: memoryStorage(), createMutationId: () => `mutation-${++mutation}`,
    api: {
      getSettings: async () => adminFixture,
      putSettings: () => { writes += 1; return write.promise },
      getSettingsReceipt: async () => ({ status: 'unconfirmed' }),
    },
  })
  await controller.load('operations')
  controller.edit('operations', draftFixture)

  const first = controller.save('operations')
  const second = controller.save('operations')
  write.resolve({ resource: savedResource, receipt: {} })

  assert.deepEqual(await Promise.all([first, second]), [true, false])
  assert.equal(writes, 1)
})

test('save carries draft A unchanged through hash submitted state and PUT while later draft B stays dirty', async () => {
  const write = deferred()
  const started = deferred()
  const sent = []
  const laterDraft = { ...draftFixture, defaultModality: 'Retirada' }
  const controller = createBusinessSettingsController({
    context, storage: memoryStorage(), createMutationId: () => 'mutation-1',
    api: {
      getSettings: async () => adminFixture,
      putSettings: async (_resource, input) => { sent.push(input); started.resolve(); return write.promise },
      getSettingsReceipt: async () => ({ status: 'unconfirmed' }),
    },
  })
  await controller.load('operations')
  controller.edit('operations', draftFixture)

  const pending = controller.save('operations')
  controller.edit('operations', laterDraft)
  await started.promise

  assert.deepEqual(sent[0].data, draftFixture)
  assert.deepEqual(controller.getResources().operations.submitted.data, draftFixture)
  assert.deepEqual(controller.getResources().operations.draft, laterDraft)
  write.resolve({ resource: savedResource, receipt: {} })
  assert.equal(await pending, true)
  assert.deepEqual(controller.getResources().operations.draft, laterDraft)
  assert.equal(controller.getResources().operations.dirty, true)
})

test('preparation failure releases the synchronous reservation for a later explicit attempt', async () => {
  let writes = 0
  let failHash = true
  const controller = createBusinessSettingsController({
    context, storage: memoryStorage(), createMutationId: () => 'mutation-1',
    hash: async () => {
      if (failHash) { failHash = false; throw new Error('digest unavailable') }
      return 'payload-hash'
    },
    api: {
      getSettings: async () => adminFixture,
      putSettings: async (_resource, input) => { writes += 1; return { resource: { ...savedResource, data: input.data }, receipt: {} } },
      getSettingsReceipt: async () => ({ status: 'unconfirmed' }),
    },
  })
  await controller.load('operations')
  controller.edit('operations', draftFixture)
  await assert.rejects(controller.save('operations'), /digest unavailable/)

  assert.equal(await controller.save('operations'), true)
  assert.equal(writes, 1)
})

test('refresh after editing advances confirmed without discarding the original base or draft', async () => {
  let reads = 0
  const remote = { ...adminFixture, revision: 2, data: { ...adminFixture.data, defaultModality: 'Local' } }
  const controller = createBusinessSettingsController({
    context, storage: memoryStorage(),
    api: {
      getSettings: async () => ++reads === 1 ? adminFixture : remote,
      putSettings: async () => assert.fail('refresh must not save'),
      getSettingsReceipt: async () => ({ status: 'unconfirmed' }),
    },
  })
  await controller.load('operations')
  controller.edit('operations', draftFixture)
  await controller.load('operations')

  const state = controller.getResources().operations
  assert.deepEqual(state.confirmed, remote)
  assert.deepEqual(state.base, adminFixture)
  assert.deepEqual(state.draft, draftFixture)
  assert.equal(state.dirty, true)
})

test('refresh during saving preserves submitted ownership and the PUT confirmation still wins', async () => {
  const write = deferred()
  const writeStarted = deferred()
  let reads = 0
  const controller = createBusinessSettingsController({
    context, storage: memoryStorage(), createMutationId: () => 'mutation-1',
    api: {
      getSettings: async () => { reads += 1; return adminFixture },
      putSettings: async () => { writeStarted.resolve(); return write.promise },
      getSettingsReceipt: async () => ({ status: 'unconfirmed' }),
    },
  })
  await controller.load('operations')
  controller.edit('operations', draftFixture)
  const saving = controller.save('operations')
  await writeStarted.promise
  await controller.load('operations')

  assert.equal(controller.getResources().operations.status, 'saving')
  assert.deepEqual(controller.getResources().operations.submitted.data, draftFixture)
  write.resolve({ resource: savedResource, receipt: {} })
  assert.equal(await saving, true)
  assert.deepEqual(controller.getResources().operations.confirmed, savedResource)
  assert.equal(reads, 2)
})

test('blocked storage does not let refresh abandon an in-memory save or admit another PUT', async () => {
  const write = deferred()
  const writeStarted = deferred()
  let writes = 0
  const blockedStorage = {
    get length() { throw new Error('blocked') }, key() { throw new Error('blocked') },
    getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') },
  }
  const controller = createBusinessSettingsController({
    context, storage: blockedStorage, createMutationId: () => 'mutation-1',
    api: {
      getSettings: async () => adminFixture,
      putSettings: async () => { writes += 1; writeStarted.resolve(); return write.promise },
      getSettingsReceipt: async () => ({ status: 'unconfirmed' }),
    },
  })
  await controller.load('operations')
  controller.edit('operations', draftFixture)
  const saving = controller.save('operations')
  await writeStarted.promise
  await controller.load('operations')

  assert.equal(await controller.save('operations'), false)
  assert.equal(writes, 1)
  write.resolve({ resource: savedResource, receipt: {} })
  assert.equal(await saving, true)
})

test('an older refresh cannot regress a newer save confirmation', async () => {
  const staleRead = deferred()
  let reads = 0
  const controller = createBusinessSettingsController({
    context, storage: memoryStorage(), createMutationId: () => 'mutation-1',
    api: {
      getSettings: async () => ++reads === 1 ? adminFixture : staleRead.promise,
      putSettings: async () => ({ resource: savedResource, receipt: {} }),
      getSettingsReceipt: async () => ({ status: 'unconfirmed' }),
    },
  })
  await controller.load('operations')
  const refresh = controller.load('operations')
  controller.edit('operations', draftFixture)
  assert.equal(await controller.save('operations'), true)
  staleRead.resolve(adminFixture)
  assert.equal(await refresh, true)

  const state = controller.getResources().operations
  assert.deepEqual(state.confirmed, savedResource)
  assert.deepEqual(state.base, savedResource)
  assert.equal(state.dirty, false)
})

test('refresh after conflict or unknown result preserves the submitted intention', async () => {
  for (const outcome of ['conflict', 'unknown']) {
    const error = outcome === 'conflict'
      ? Object.assign(new Error('changed'), { status: 409, code: 'SETTINGS_REVISION_CONFLICT' })
      : new TypeError('network lost')
    let reads = 0
    const controller = createBusinessSettingsController({
      context, storage: memoryStorage(), createMutationId: () => `mutation-${outcome}`,
      api: {
        getSettings: async () => { reads += 1; return reads === 1 ? adminFixture : savedResource },
        putSettings: async () => { throw error },
        getSettingsReceipt: async () => ({ status: 'unconfirmed' }),
      },
    })
    await controller.load('operations')
    controller.edit('operations', draftFixture)
    await controller.save('operations')
    await controller.load('operations')

    const state = controller.getResources().operations
    assert.equal(state.status, outcome === 'unknown' ? 'unconfirmed' : outcome)
    assert.deepEqual(state.base, adminFixture)
    assert.deepEqual(state.draft, draftFixture)
    assert.deepEqual(state.submitted.data, draftFixture)
  }
})

test('receipt reconciliation cannot regress a newer confirmed revision from refresh', async () => {
  const revisionThree = { ...savedResource, revision: 3, data: { ...draftFixture, defaultModality: 'Local' } }
  let reads = 0
  const controller = createBusinessSettingsController({
    context, storage: memoryStorage(), createMutationId: () => 'mutation-1',
    api: {
      getSettings: async () => [adminFixture, revisionThree, savedResource][reads++],
      putSettings: async () => { throw new TypeError('response lost') },
      getSettingsReceipt: async () => ({ status: 'confirmed', receipt: { mutationId: 'mutation-1', committedRevision: 2 } }),
    },
  })
  await controller.load('operations')
  controller.edit('operations', draftFixture)
  await controller.save('operations')
  await controller.load('operations')

  assert.equal(await controller.reconcile('operations'), false)
  const state = controller.getResources().operations
  assert.equal(state.status, 'unconfirmed')
  assert.equal(state.confirmed.revision, 3)
  assert.deepEqual(state.submitted.data, draftFixture)
})

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

test('accepted conflict review updates the base and draft without saving until a new explicit click', async () => {
  const conflict = Object.assign(new Error('changed elsewhere'), { status: 409, code: 'SETTINGS_REVISION_CONFLICT' })
  const current = { ...adminFixture, revision: 2, data: { ...adminFixture.data, defaultModality: 'Local' } }
  let reads = 0
  let writes = 0
  let mutation = 0
  let openedReview = null
  const controller = createBusinessSettingsController({
    context, storage: memoryStorage(), createMutationId: () => `mutation-${++mutation}`,
    onConflictReview: (review) => { openedReview = review },
    api: {
      getSettings: async () => ++reads === 1 ? adminFixture : current,
      putSettings: async (_resource, input) => {
        writes += 1
        if (writes === 1) throw conflict
        return { resource: { ...current, revision: 3, data: input.data }, receipt: { mutationId: input.mutationId } }
      },
      getSettingsReceipt: async () => ({ status: 'unconfirmed' }),
    },
  })
  await controller.load('operations')
  controller.edit('operations', draftFixture)
  assert.equal(await controller.save('operations'), false)

  const review = openedReview
  assert.ok(review)
  assert.equal(reads, 2)
  assert.equal(writes, 1)
  assert.equal(controller.acceptConflictReview(review, review.candidate), true)
  let state = controller.getResources().operations
  assert.equal(state.status, 'ready')
  assert.equal(state.base.revision, 2)
  assert.deepEqual(state.draft, review.candidate)
  assert.equal(state.dirty, true)
  assert.equal(writes, 1)

  assert.equal(await controller.save('operations'), true)
  state = controller.getResources().operations
  assert.equal(writes, 2)
  assert.equal(state.confirmed.revision, 3)
  assert.equal(mutation, 2)
})

test('logout invalidates an open conflict review and its late decision', async () => {
  const conflict = Object.assign(new Error('changed elsewhere'), { status: 409, code: 'SETTINGS_REVISION_CONFLICT' })
  const current = { ...adminFixture, revision: 2 }
  let reads = 0
  let openedReview = null
  const controller = createBusinessSettingsController({
    context, storage: memoryStorage(), createMutationId: () => 'mutation-1',
    onConflictReview: (review) => { openedReview = review },
    api: {
      getSettings: async () => ++reads === 1 ? adminFixture : current,
      putSettings: async () => { throw conflict },
      getSettingsReceipt: async () => ({ status: 'unconfirmed' }),
    },
  })
  await controller.load('operations')
  controller.edit('operations', draftFixture)
  await controller.save('operations')
  const review = openedReview
  assert.ok(review)
  controller.reset()

  assert.equal(controller.acceptConflictReview(review, review.candidate), false)
  assert.deepEqual(controller.getResources(), {})
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

test('an in-memory uncertain save expires at exactly 24 hours and preserves a later draft for review', async () => {
  let clock = new Date('2026-09-13T10:00:00.000Z')
  let reads = 0
  let receiptReads = 0
  let writes = 0
  const current = { ...savedResource, data: draftFixture }
  const laterDraft = { ...draftFixture, defaultModality: 'Retirada' }
  const controller = createBusinessSettingsController({
    context, storage: memoryStorage(), now: () => clock, createMutationId: () => 'mutation-1',
    api: {
      getSettings: async () => { reads += 1; return reads === 1 ? adminFixture : current },
      putSettings: async () => { writes += 1; throw new TypeError('response lost') },
      getSettingsReceipt: async () => { receiptReads += 1; return { status: 'confirmed' } },
    },
  })
  await controller.load('operations')
  controller.edit('operations', draftFixture)
  await controller.save('operations')
  controller.edit('operations', laterDraft)
  clock = new Date('2026-09-14T10:00:00.000Z')

  assert.equal(await controller.reconcile('operations'), false)
  const state = controller.getResources().operations
  assert.equal(receiptReads, 0)
  assert.equal(writes, 1)
  assert.equal(reads, 2)
  assert.equal(state.status, 'ready')
  assert.deepEqual(state.confirmed, current)
  assert.deepEqual(state.base, current)
  assert.deepEqual(state.draft, laterDraft)
  assert.equal(state.dirty, true)
  assert.equal(state.submitted, null)
})

test('401 while reviewing an in-memory expired save invalidates the session and pending context', async () => {
  let clock = new Date('2026-09-13T10:00:00.000Z')
  let reads = 0
  let expirations = 0
  const storage = memoryStorage()
  const unauthorized = Object.assign(new Error('expired session'), { status: 401 })
  const controller = createBusinessSettingsController({
    context, storage, now: () => clock, createMutationId: () => 'mutation-1', onSessionExpired: () => { expirations += 1 },
    api: {
      getSettings: async () => { reads += 1; if (reads > 1) throw unauthorized; return adminFixture },
      putSettings: async () => { throw new TypeError('response lost') },
      getSettingsReceipt: async () => assert.fail('expired attempts must read current state first'),
    },
  })
  await controller.load('operations')
  controller.edit('operations', draftFixture)
  await controller.save('operations')
  clock = new Date('2026-09-14T10:00:00.000Z')

  assert.equal(await controller.reconcile('operations'), false)
  assert.equal(expirations, 1)
  assert.deepEqual(controller.getResources(), {})
  assert.equal(storage.length, 0)
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
