import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act, create } from 'react-test-renderer'
import {
  createEffectiveBusinessConfigCache,
  shouldAcceptEffectiveReply,
  useEffectiveBusinessConfig,
} from './useEffectiveBusinessConfig.js'

const owner = (overrides = {}) => ({
  businessId: 'business-1', generation: 2, settingsContextId: 'context-1',
  capabilities: ['orders.create', 'printing.execute'], requestId: 0, ...overrides,
})
const config = (version, operationsRevision) => ({ version, revisions: { operations: operationsRevision }, operations: { defaultModality: 'Entrega' } })

test('first owner change render masks old config and rejects a captured callback', async (t) => {
  const renders = []
  let current
  const Harness = ({ identity, bootstrap }) => {
    current = useEffectiveBusinessConfig({ owner: identity, bootstrapConfig: bootstrap })
    renders.push(current.config?.version ?? null)
    return null
  }
  let renderer
  await act(async () => { renderer = create(React.createElement(Harness, { identity: owner({ userId: 'a' }), bootstrap: config('private-a', 1) })) })
  t.after(() => renderer.unmount())
  const oldAccept = current.accept
  renders.length = 0
  await act(async () => renderer.update(React.createElement(Harness, { identity: owner({ userId: 'b', generation: 3 }) })))
  assert.equal(renders[0], null)
  await act(async () => { assert.equal(oldAccept(config('late-a', 2)), false) })
  assert.equal(current.config, null)
})

test('reply ownership rejects stale request, session, business, context and capability identities', () => {
  const current = owner({ requestId: 8 })
  assert.equal(shouldAcceptEffectiveReply(current, owner({ requestId: 7 })), false)
  assert.equal(shouldAcceptEffectiveReply(current, owner({ requestId: 9 })), true)
  assert.equal(shouldAcceptEffectiveReply(current, owner({ requestId: 9, generation: 1 })), false)
  assert.equal(shouldAcceptEffectiveReply(current, owner({ requestId: 9, businessId: 'business-2' })), false)
  assert.equal(shouldAcceptEffectiveReply(current, owner({ requestId: 9, settingsContextId: 'context-2' })), false)
  assert.equal(shouldAcceptEffectiveReply(current, owner({ requestId: 9, capabilities: ['orders.create'] })), false)
})

test('bootstrap config is accepted once and equal opaque version refresh stays lightweight', async () => {
  const calls = []
  const cache = createEffectiveBusinessConfigCache({ load: async (knownVersion) => {
    calls.push(knownVersion)
    return { effectiveConfigVersion: knownVersion }
  } })
  cache.setOwner(owner())
  assert.equal(cache.accept(config('opaque-z', 2), owner()), true)
  assert.equal(await cache.refresh(), true)
  assert.deepEqual(calls, ['opaque-z'])
  assert.equal(cache.getState().config.version, 'opaque-z')
  assert.equal(cache.getState().status, 'ready')
})

test('out-of-order and regressive revisions never replace the current projection', async () => {
  const pending = []
  const cache = createEffectiveBusinessConfigCache({ load: () => new Promise((resolve) => pending.push(resolve)) })
  cache.setOwner(owner())
  cache.accept(config('opaque-a', 1), owner())
  const olderRequest = cache.refresh()
  const newerRequest = cache.refresh()
  pending[1](config('opaque-c', 3))
  assert.equal(await newerRequest, true)
  pending[0](config('opaque-b', 2))
  assert.equal(await olderRequest, false)
  assert.equal(cache.getState().config.version, 'opaque-c')
  assert.equal(cache.accept(config('opaque-any', 2), owner({ requestId: 2 })), false)
})

test('owner reset invalidates late replies and load errors never invent confirmed defaults', async () => {
  let release
  const cache = createEffectiveBusinessConfigCache({ load: () => new Promise((resolve) => { release = resolve }) })
  cache.setOwner(owner())
  const request = cache.refresh()
  cache.setOwner(owner({ generation: 3, settingsContextId: 'context-2' }))
  release(config('old-session', 4))
  assert.equal(await request, false)
  assert.equal(cache.getState().config, null)

  cache.setLoad(async () => { throw new Error('offline') })
  assert.equal(await cache.refresh(), false)
  assert.equal(cache.getState().config, null)
  assert.equal(cache.getState().status, 'error')
  assert.equal(typeof useEffectiveBusinessConfig, 'function')
})
