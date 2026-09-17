import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act } from 'react-test-renderer'

import { workspaceHarness } from '../../../test-support/renderWorkspace.js'

const owner = {
  businessId: 'business-1',
  generation: 1,
  settingsContextId: 'settings-context-1',
  capabilities: ['operations.settings.manage'],
}

test('maps the effective-config owner and routes generic transport calls to the settings registry', async (t) => {
  const h = await workspaceHarness(t)
  const { createSettingsPolicyTransport, toPolicyEditingContext } = await h.load('/src/app/surfaces/settings/SettingsPolicyBoundary.jsx')
  const calls = []
  const transport = createSettingsPolicyTransport({
    operations: {
      load: (scopeId) => { calls.push(['load', scopeId]); return 'loaded' },
      save: (input, scopeId) => { calls.push(['save', input, scopeId]); return 'saved' },
      loadReceipt: (mutationId, scopeId) => { calls.push(['receipt', mutationId, scopeId]); return 'receipt' },
    },
  })

  assert.deepEqual(toPolicyEditingContext(owner), {
    ownerId: 'business-1', generation: 1, contextId: 'settings-context-1', capabilities: ['operations.settings.manage'],
  })
  assert.equal(await transport.load('operations'), 'loaded')
  assert.equal(await transport.save('operations', { data: true }), 'saved')
  assert.equal(await transport.loadReceipt('operations', 'mutation-1'), 'receipt')
  assert.deepEqual(calls, [
    ['load', undefined], ['save', { data: true }, undefined], ['receipt', 'mutation-1', undefined],
  ])
})

test('resets provider-owned policy state when the mapped owner identity changes', async (t) => {
  const h = await workspaceHarness(t)
  globalThis.fetch = async (path) => {
    assert.equal(path, '/api/settings/operations')
    return { ok: true, json: async () => ({ settings: { revision: 1, data: { enabled: true } } }) }
  }
  const [{ SettingsPolicyBoundary }, { usePolicyEditing }] = await Promise.all([
    h.load('/src/app/surfaces/settings/SettingsPolicyBoundary.jsx'),
    h.load('/src/app/policy-editing/policyEditingContext.js'),
  ])
  const api = React.createRef()
  function Probe() {
    const value = usePolicyEditing()
    React.useImperativeHandle(api, () => value, [value])
    return null
  }
  const props = { effectiveConfigOwner: owner, storage: h.sessionStorage, children: React.createElement(Probe) }
  const renderer = await h.render(SettingsPolicyBoundary, props)

  await act(async () => assert.equal(await api.current.load('operations'), true))
  assert.ok(api.current.resources.operations)
  await act(async () => renderer.update(React.createElement(SettingsPolicyBoundary, {
    ...props, effectiveConfigOwner: { ...owner, generation: 2 },
  })))
  assert.deepEqual(api.current.resources, {})
})
