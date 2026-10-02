import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { useSessionRuntime, sessionHasOperationalAccess } from './useSessionRuntime.js'
import { decideSessionExit } from './sessionExitGuard.js'
import { createSessionApi } from '../../../infrastructure/auth/sessionApi.js'

const session = (scope, id = 'A') => ({ authenticated: true, authMode: 'multi_company', scope, contextId: id, account: { id: 'account' }, businessId: scope === 'business' ? id : undefined, settingsContextId: scope === 'business' ? id : undefined, capabilities: [] })
test('identity and platform scopes never bootstrap operational data; all three are valid trusted sessions', async () => {
  for (const scope of ['identity', 'platform', 'business']) {
    assert.equal(sessionHasOperationalAccess(session(scope)), scope === 'business')
    assert.equal((await createSessionApi({ request: async () => session(scope) }).getSession({ requireContext: true })).scope, scope)
  }
  assert.equal(decideSessionExit({ contextChangePending: true }), 'blocked')
})

test('scope switch captures old context, blocks in-flight actions and holds guard through uncertain cookie rediscovery', async t => {
  let current, resolvePost, resolveRead, reads = 0, postCount = 0, bootstrap = 0, pendingWork = false, published = 0
  const api = {
    getSession: async () => ++reads === 1 ? session('business') : new Promise(resolve => { resolveRead = resolve }),
    selectBusiness: async (id, origin) => { postCount++; assert.equal(id, 'B'); assert.equal(origin.contextId, 'A'); return new Promise(resolve => { resolvePost = resolve }) },
    logout: async () => { throw new Error('must be blocked') },
  }
  function Harness() { current = useSessionRuntime({ api, canChangeContext: () => !pendingWork, refreshBootstrap: async () => { bootstrap++ }, coordinatorFactory: () => ({ publish() { published++ }, close() {} }) }); return null }
  let renderer
  await act(async () => { renderer = create(React.createElement(Harness)) })
  t.after(() => renderer.unmount())
  assert.equal(bootstrap, 1)
  pendingWork = true
  await act(async () => { assert.equal(await current.selectBusiness('B'), false) })
  assert.equal(postCount, 0)
  pendingWork = false
  let operation
  await act(async () => { operation = current.selectBusiness('B') })
  assert.equal(current.contextChangePending, true)
  await act(async () => { assert.equal(await current.selectBusiness('B'), false); assert.equal(await current.handleLogout(), false) })
  await act(async () => { resolvePost(null) })
  assert.equal(current.sessionContext, null); assert.equal(current.contextChangePending, true)
  await act(async () => { resolveRead(session('business', 'B')); await operation })
  assert.equal(postCount, 1); assert.equal(published, 1); assert.equal(current.sessionContext.contextId, 'B'); assert.equal(current.contextChangePending, false)
})
