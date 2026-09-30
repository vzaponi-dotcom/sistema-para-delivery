import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { workspaceHarness } from '../../../test-support/renderWorkspace.js'
import { setup, manager, response, fill, submit, nodeText, act } from '../../../test-support/accessUi.js'

async function account(t, { capabilities = [], passwordResponse, verificationFailure = false } = {}) {
  const h = await workspaceHarness(t)
  let runtime, reads = 0, broadcasts = 0, invalidate
  let cookie = { ...manager, authenticated: true, capabilities, businessId: 'b', settingsContextId: 's', authMode: 'user_only' }
  const writes = []
  globalThis.fetch = async (url, options) => {
    if (url === '/api/auth/session') {
      reads++
      if (verificationFailure && reads > 1) throw new Error('verification unavailable')
      return response(structuredClone(cookie))
    }
    assert.equal(url, '/api/access/me/password')
    writes.push(JSON.parse(options.body))
    return passwordResponse ? passwordResponse() : response({ changed: true })
  }
  const [{ default: MyAccount }, { useSessionRuntime }] = await Promise.all([h.load('/src/domains/access/ui/MyAccount.jsx'), h.load('/src/app/runtime/session/useSessionRuntime.js')])
  const coordinatorFactory = ({ onInvalidate }) => { invalidate = onInvalidate; return { publish() { broadcasts++ }, close() {} } }
  function AccountHost() {
    runtime = useSessionRuntime({ coordinatorFactory })
    return React.createElement(MyAccount, { sessionContext: runtime.sessionContext, runCredentialChange: runtime.runCredentialChange })
  }
  const screen = await h.render(AccountHost)
  return { screen, writes, get reads() { return reads }, get broadcasts() { return broadcasts }, get runtime() { return runtime }, changeCookie(value) { cookie = value }, invalidate() { invalidate() } }
}

for (const capabilities of [[], manager.capabilities]) test(`own password with ${capabilities.length} grants uses runtime confirmation and broadcast`, async t => {
  const driver = await account(t, { capabilities })
  await fill(driver.screen, 'currentPassword', 'current-password-long'); await fill(driver.screen, 'password', 'new-password-long-enough'); await submit(driver.screen)
  assert.deepEqual(driver.writes, [{ currentPassword: 'current-password-long', password: 'new-password-long-enough' }])
  assert.equal(driver.broadcasts, 1); assert.equal(driver.reads, 2)
  assert.equal(driver.screen.root.findAllByType('input').every(n => n.props.value === ''), true)
})

test('credential race refreshes private context through runtime without replaying password change', async t => {
  const driver = await account(t, { passwordResponse: () => response({ error: { code: 'CREDENTIAL_CHANGED', message: 'Entre novamente.' } }, 409) })
  await fill(driver.screen, 'currentPassword', 'current-password-long'); await fill(driver.screen, 'password', 'new-password-long-enough'); await submit(driver.screen)
  assert.equal(driver.writes.length, 1); assert.equal(driver.reads, 2); assert.equal(driver.broadcasts, 0)
  assert.equal(driver.runtime.isCredentialChangePending(), false)
})

test('delayed confirmed rotation after owner invalidation verifies cookie but restores no old UI secrets or feedback', async t => {
  let finishPost
  const driver = await account(t, { passwordResponse: () => new Promise(resolve => { finishPost = () => resolve(response({ changed: true })) }) })
  await fill(driver.screen, 'currentPassword', 'private-password'); await fill(driver.screen, 'password', 'new-password-long-enough')
  await act(async () => { driver.screen.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
  driver.changeCookie({ ...manager, user: { id: 'next', displayName: 'Next' }, authenticated: true, capabilities: [], businessId: 'b', settingsContextId: 's', authMode: 'user_only' })
  await act(async () => driver.invalidate())
  assert.equal(driver.screen.root.findAllByType('input').every(n => n.props.value === ''), true)
  await act(async () => finishPost())
  assert.equal(driver.reads, 3); assert.equal(driver.broadcasts, 1); assert.equal(driver.writes.length, 1)
  assert.doesNotMatch(nodeText(driver.screen.root), /Maria|Senha alterada/)
  assert.equal(driver.screen.root.findAllByType('input').every(n => n.props.value === ''), true)
})

test('failed trusted refresh after confirmed rotation masks private context and never repeats write', async t => {
  const driver = await account(t, { verificationFailure: true })
  await fill(driver.screen, 'currentPassword', 'current-password-long'); await fill(driver.screen, 'password', 'new-password-long-enough'); await submit(driver.screen)
  assert.equal(driver.writes.length, 1); assert.equal(driver.broadcasts, 1); assert.equal(driver.reads, 2)
  assert.equal(driver.runtime.authState, 'anonymous'); assert.equal(driver.runtime.isCredentialChangePending(), false)
  assert.doesNotMatch(nodeText(driver.screen.root), /Maria|Senha alterada/)
})

test('account without runtime credential integration cannot send an unguarded cookie-changing write', async t => {
  const { screen } = await setup(t, 'MyAccount', { sessionContext: manager }, () => assert.fail('unguarded write'))
  await fill(screen, 'currentPassword', 'current-password-long'); await fill(screen, 'password', 'new-password-long-enough'); await submit(screen)
  assert.match(nodeText(screen.root), /contexto da sessão/)
})
