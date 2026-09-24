import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act } from 'react-test-renderer'

import { workspaceHarness } from '../../test-support/renderWorkspace.js'
import { createPolicyNavigationBridge } from './policyNavigationBridge.js'

const base = { revision: 1, data: { enabled: false } }
const current = { revision: 2, data: { enabled: false, remote: true } }
const saved = { revision: 2, data: { enabled: true } }
const context = { ownerId: 'business-1', generation: 1, contextId: 'context-1', capabilities: ['operations.manage'] }

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}

const waitFor = async (condition, description, timeoutMs = 1000) => {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${description}`)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)))
  }
}

const memoryStorage = () => {
  const values = new Map()
  return {
    get length() { return values.size }, key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key),
  }
}

async function mountProvider(t, options = {}) {
  const h = await workspaceHarness(t)
  const { PolicyEditingProvider } = await h.load('/src/app/policy-editing/PolicyEditingProvider.jsx')
  const { usePolicyEditing } = await h.load('/src/app/policy-editing/policyEditingContext.js')
  const api = React.createRef()
  function Probe() {
    const value = usePolicyEditing()
    React.useImperativeHandle(api, () => value, [value])
    return React.createElement('output', null, value.activeConflict?.resourceKey || '')
  }
  const props = {
    transport: {
      load: async () => base,
      save: async () => ({ resource: saved, receipt: { committedRevision: 2 } }),
      loadReceipt: async () => ({ status: 'unconfirmed' }),
    },
    context,
    storage: memoryStorage(),
    resolveNavigationDraft: (resources, destination) => resources.operations?.dirty ? { destination, resourceKey: 'operations' } : null,
    ...options,
    children: React.createElement(Probe),
  }
  const renderer = await h.render(PolicyEditingProvider, props)
  return { h, api, props, renderer, PolicyEditingProvider }
}

test('provider delegates policy edits and forwards only confirmed commits', async (t) => {
  const committed = []
  const fixture = await mountProvider(t, { onPolicyCommitted: (event) => committed.push(event) })

  await act(async () => assert.equal(await fixture.api.current.load('operations'), true))
  await act(async () => assert.equal(fixture.api.current.edit('operations', { enabled: true }), true))
  await act(async () => assert.equal(await fixture.api.current.save('operations'), true))

  assert.deepEqual(fixture.api.current.resources.operations.confirmed, saved)
  assert.deepEqual(committed, [{ policyId: 'operations', resourceKey: 'operations', scopeId: undefined }])
})

test('provider clears removed callbacks before later confirmation feedback or session expiry', async (t) => {
  const committed = []
  const feedback = []
  const expired = []
  const fixture = await mountProvider(t, {
    onPolicyCommitted: (event) => committed.push(event),
    onFeedback: (event) => feedback.push(event),
    onSessionExpired: (error) => expired.push(error),
  })
  const callbackFreeProps = { ...fixture.props }
  delete callbackFreeProps.onPolicyCommitted
  delete callbackFreeProps.onFeedback
  delete callbackFreeProps.onSessionExpired

  await act(async () => fixture.renderer.update(React.createElement(fixture.PolicyEditingProvider, callbackFreeProps, fixture.props.children)))
  await act(async () => fixture.api.current.load('operations'))
  await act(async () => fixture.api.current.edit('operations', { enabled: true }))
  await act(async () => fixture.api.current.save('operations'))

  assert.deepEqual(committed, [])
  assert.deepEqual(feedback, [])

  const expiredTransport = {
    ...fixture.props.transport,
    save: async () => { throw { status: 401 } },
  }
  await act(async () => fixture.renderer.update(React.createElement(fixture.PolicyEditingProvider, {
    ...callbackFreeProps,
    transport: expiredTransport,
  }, fixture.props.children)))
  await act(async () => fixture.api.current.edit('operations', { enabled: false }))
  await act(async () => fixture.api.current.save('operations'))

  assert.deepEqual(expired, [])
})

test('provider owns active conflicts through reopen, accept, dismiss, and context reset', async (t) => {
  let reads = 0
  const fixture = await mountProvider(t, {
    transport: {
      load: async () => ++reads === 1 ? base : current,
      save: async () => { throw { status: 409, message: 'stale' } },
      loadReceipt: async () => ({ status: 'unconfirmed' }),
    },
  })

  await act(async () => fixture.api.current.load('operations'))
  await act(async () => fixture.api.current.edit('operations', { enabled: true }))
  await act(async () => fixture.api.current.save('operations'))
  const firstConflict = fixture.api.current.activeConflict
  assert.equal(firstConflict.resourceKey, 'operations')

  await act(async () => assert.equal(fixture.api.current.acceptActiveConflict(firstConflict.candidate), true))
  assert.equal(fixture.api.current.activeConflict, null)

  await act(async () => fixture.api.current.save('operations'))
  let reopened
  await act(async () => { reopened = await fixture.api.current.reviewConflict('operations') })
  assert.equal(fixture.api.current.activeConflict, reopened)
  await act(async () => fixture.api.current.dismissActiveConflict())
  assert.equal(fixture.api.current.activeConflict, null)

  await act(async () => fixture.api.current.reviewConflict('operations'))
  const nextProps = {
    ...fixture.props,
    context: { ...context, generation: 2 },
  }
  delete nextProps.children
  await act(async () => fixture.renderer.update(React.createElement(fixture.PolicyEditingProvider, nextProps, fixture.props.children)))
  assert.equal(fixture.api.current.activeConflict, null)
  assert.deepEqual(fixture.api.current.resources, {})
})

test('discard clears the matching active conflict only when the discard succeeds', async (t) => {
  let reads = 0
  const fixture = await mountProvider(t, {
    transport: {
      load: async () => ++reads === 1 ? base : current,
      save: async () => { throw { status: 409 } },
      loadReceipt: async () => ({ status: 'unconfirmed' }),
    },
  })

  assert.equal(fixture.api.current.discard('operations'), false)
  await act(async () => fixture.api.current.load('operations'))
  await act(async () => fixture.api.current.edit('operations', { enabled: true }))
  await act(async () => fixture.api.current.save('operations'))
  assert.equal(fixture.api.current.activeConflict.resourceKey, 'operations')
  await act(async () => assert.equal(fixture.api.current.discard('operations'), true))
  assert.equal(fixture.api.current.activeConflict, null)
})

test('provider connects navigation through a narrow draft and discard contract', async (t) => {
  const bridge = createPolicyNavigationBridge()
  const fixture = await mountProvider(t, { navigationBridge: bridge })

  assert.equal(bridge.getNavigationDraft('settings-operations'), null)
  await act(async () => fixture.api.current.load('operations'))
  await act(async () => fixture.api.current.edit('operations', { enabled: true }))
  assert.deepEqual(bridge.getNavigationDraft('settings-operations'), { destination: 'settings-operations', resourceKey: 'operations' })
  assert.equal(Object.hasOwn(bridge, 'resources'), false)
  await act(async () => assert.equal(bridge.discardNavigationDraft('operations'), true))
  assert.equal(bridge.getNavigationDraft('settings-operations'), null)
})

test('provider registers beforeunload only for dirty saving or unconfirmed resources', async (t) => {
  const pendingSave = deferred()
  const fixture = await mountProvider(t, {
    transport: {
      load: async () => base,
      save: () => pendingSave.promise,
      loadReceipt: async () => ({ status: 'unconfirmed' }),
    },
  })
  const listenerCount = () => fixture.h.activitySnapshot({ ignoreFocus: true }).listeners
  const assertUnload = (expected) => {
    const event = new Event('beforeunload', { cancelable: true })
    fixture.h.window.dispatchEvent(event)
    assert.equal(event.defaultPrevented, expected)
  }
  const initialListeners = listenerCount()
  assertUnload(false)

  await act(async () => fixture.api.current.load('operations'))
  await act(async () => fixture.api.current.edit('operations', { enabled: true }))
  assert.equal(listenerCount(), initialListeners + 1)
  assertUnload(true)
  await act(async () => fixture.api.current.discard('operations'))
  assert.equal(listenerCount(), initialListeners)

  await act(async () => fixture.api.current.edit('operations', { enabled: true }))
  const saving = fixture.api.current.save('operations')
  await waitFor(
    () => fixture.api.current.resources.operations.status === 'saving',
    'the provider to publish the saving state after hashing',
  )
  assert.equal(fixture.api.current.resources.operations.status, 'saving')
  assertUnload(true)
  pendingSave.reject({ status: 503 })
  await act(async () => assert.equal(await saving, false))
  assert.equal(fixture.api.current.resources.operations.status, 'unconfirmed')
  assertUnload(true)
})


test('provider forwards an ephemeral save attachment without adding it to provider resources', async (t) => {
  let receivedTransient
  const transient = { logoBlob: new Blob(['provider-logo'], { type: 'image/webp' }) }
  const fixture = await mountProvider(t, {
    transport: {
      load: async () => base,
      save: async (_resource, _input, _scopeId, attachment) => {
        receivedTransient = attachment
        return { resource: saved, receipt: { committedRevision: 2 } }
      },
      loadReceipt: async () => ({ status: 'unconfirmed' }),
    },
  })

  await act(async () => fixture.api.current.load('operations'))
  await act(async () => fixture.api.current.edit('operations', { enabled: true }))
  await act(async () => assert.equal(await fixture.api.current.save('operations', undefined, transient), true))

  assert.equal(receivedTransient, transient)
  assert.equal(Object.hasOwn(fixture.api.current.resources.operations, 'transient'), false)
})


test('dirty business profile participates in beforeunload and context change clears the resource owner', async (t) => {
  const profile = {
    revision: 1,
    data: {
      name: 'Operação A',
      phone: '',
      address: { line: '', number: '', complement: '', neighborhood: '', city: '', state: '', postalCode: '' },
      logo: { present: false, version: null },
      logoAction: 'keep',
    },
  }
  const fixture = await mountProvider(t, {
    transport: {
      load: async () => profile,
      save: async () => ({ resource: profile, receipt: {} }),
      loadReceipt: async () => ({ status: 'unconfirmed' }),
    },
  })

  await act(async () => fixture.api.current.load('businessProfile'))
  await act(async () => fixture.api.current.edit('businessProfile', {
    ...profile.data,
    logo: { present: true, version: `local:${'d'.repeat(64)}` },
    logoAction: 'replace',
  }))

  const event = new Event('beforeunload', { cancelable: true })
  fixture.h.window.dispatchEvent(event)
  assert.equal(event.defaultPrevented, true)

  const nextProps = { ...fixture.props, context: { ...context, ownerId: 'business-2', contextId: 'context-2', generation: 2 } }
  delete nextProps.children
  await act(async () => fixture.renderer.update(React.createElement(
    fixture.PolicyEditingProvider,
    nextProps,
    fixture.props.children,
  )))
  assert.deepEqual(fixture.api.current.resources, {})
})
