import assert from 'node:assert/strict'
import test from 'node:test'
import { adminFixture, draftFixture } from '../../test-support/settingsFixtures.js'
import { createPolicyEditingState, policyEditingReducer } from './policyEditingState.js'

test('loaded, edited and discarded states keep confirmed base and draft separate', () => {
  let state = createPolicyEditingState()
  state = policyEditingReducer(state, { type: 'loaded', value: adminFixture })
  assert.equal(state.status, 'ready')
  assert.deepEqual(state.confirmed, adminFixture)
  assert.deepEqual(state.base, adminFixture)
  assert.deepEqual(state.draft, adminFixture.data)
  assert.equal(state.dirty, false)

  state = policyEditingReducer(state, { type: 'edited', data: draftFixture })
  assert.equal(state.dirty, true)
  assert.deepEqual(state.confirmed, adminFixture)
  state = policyEditingReducer(state, { type: 'discarded' })
  assert.deepEqual(state.draft, adminFixture.data)
  assert.equal(state.dirty, false)
})

test('submitted intent is immutable while later edits remain a separate draft', () => {
  let state = policyEditingReducer(createPolicyEditingState(), { type: 'loaded', value: adminFixture })
  state = policyEditingReducer(state, { type: 'edited', data: draftFixture })
  state = policyEditingReducer(state, { type: 'saveStarted', mutationId: 'save-1', payloadHash: 'hash-1', startedAt: '2026-09-13T10:00:00.000Z' })
  const submitted = structuredClone(state.submitted)
  const laterDraft = { ...draftFixture, defaultModality: 'Retirada' }
  state = policyEditingReducer(state, { type: 'edited', data: laterDraft })

  assert.equal(state.status, 'saving')
  assert.deepEqual(state.submitted, submitted)
  assert.deepEqual(state.draft, laterDraft)

  const saved = { ...adminFixture, revision: 2, data: draftFixture }
  state = policyEditingReducer(state, { type: 'saveConfirmed', value: saved })
  assert.deepEqual(state.confirmed, saved)
  assert.deepEqual(state.base, saved)
  assert.deepEqual(state.draft, laterDraft)
  assert.equal(state.dirty, true)
  assert.equal(state.submitted, null)
})

test('unknown result preserves confirmed state and submitted intent', () => {
  let state = policyEditingReducer(createPolicyEditingState(), { type: 'loaded', value: adminFixture })
  state = policyEditingReducer(state, { type: 'edited', data: draftFixture })
  const before = state.confirmed
  state = policyEditingReducer(state, { type: 'saveStarted', mutationId: 'save-1', payloadHash: 'hash-1', startedAt: '2026-09-13T10:00:00.000Z' })
  state = policyEditingReducer(state, { type: 'saveUnconfirmed' })

  assert.equal(state.status, 'unconfirmed')
  assert.deepEqual(state.confirmed, before)
  assert.deepEqual(state.submitted.data, draftFixture)
  assert.match(state.error, /n\u00e3o confirmado/i)
})

test('confirmed save replaces official state while revision conflict preserves all edit inputs', () => {
  const saved = { ...adminFixture, revision: 2, data: draftFixture }
  let state = policyEditingReducer(createPolicyEditingState(), { type: 'loaded', value: adminFixture })
  state = policyEditingReducer(state, { type: 'edited', data: draftFixture })
  state = policyEditingReducer(state, { type: 'saveStarted', mutationId: 'save-1', payloadHash: 'hash-1', startedAt: '2026-09-13T10:00:00.000Z' })
  const conflicted = policyEditingReducer(state, { type: 'saveConflict', error: { code: 'SETTINGS_REVISION_CONFLICT' } })
  assert.equal(conflicted.status, 'conflict')
  assert.deepEqual(conflicted.base, adminFixture)
  assert.deepEqual(conflicted.draft, draftFixture)
  assert.deepEqual(conflicted.submitted.data, draftFixture)

  const confirmed = policyEditingReducer(state, { type: 'saveConfirmed', value: saved })
  assert.equal(confirmed.status, 'ready')
  assert.equal(confirmed.dirty, false)
  assert.deepEqual(confirmed.confirmed, saved)
  assert.equal(confirmed.submitted, null)
})
