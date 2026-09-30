import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { setup, manager, response, fill, submit, nodeText, act } from '../../../test-support/accessUi.js'
for (const capabilities of [[], manager.capabilities]) test(`own password works with ${capabilities.length} grants and broadcasts only confirmed rotation`, async t => {
  const calls = []
  const { screen } = await setup(t, 'MyAccount', { sessionContext: { ...manager, capabilities }, refreshSession: async options => { calls.push(['refresh', options]) } }, async (url, options) => { calls.push([url, JSON.parse(options.body)]); return response({ changed: true }) })
  await fill(screen, 'currentPassword', 'current-password-long'); await fill(screen, 'password', 'new-password-long-enough')
  await submit(screen)
  assert.deepEqual(calls, [['/api/access/me/password', { currentPassword: 'current-password-long', password: 'new-password-long-enough' }], ['refresh', { broadcast: true }]])
  assert.equal(screen.root.findAllByType('input').every(n => n.props.value === ''), true)
})
test('credential race clears private context by refresh without replaying password change', async t => {
  let writes = 0, refreshes = 0
  const { screen } = await setup(t, 'MyAccount', { sessionContext: manager, refreshSession: async () => { refreshes++ } }, async () => { writes++; return response({ error: { code: 'CREDENTIAL_CHANGED', message: 'Entre novamente.' } }, 409) })
  await fill(screen, 'currentPassword', 'current-password-long'); await fill(screen, 'password', 'new-password-long-enough'); await submit(screen)
  assert.equal(writes, 1); assert.equal(refreshes, 1)
  assert.match(nodeText(screen.root), /Entre novamente/)
})
test('delayed password success after owner changes cannot refresh the next account or restore old password', async t => {
  let resolveWrite, refreshes = 0
  const { screen, Component } = await setup(t, 'MyAccount', { sessionContext: manager, refreshSession: () => { refreshes++ } }, () => new Promise(resolve => { resolveWrite = resolve }))
  await fill(screen, 'currentPassword', 'private-password'); await fill(screen, 'password', 'new-password-long-enough')
  await act(async () => { screen.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
  await act(async () => screen.update(React.createElement(Component, { sessionContext: { user: { id: 'next', displayName: 'Next' }, capabilities: [] }, refreshSession: () => { refreshes++ } })))
  assert.equal(screen.root.findAllByType('input').every(n => n.props.value === ''), true)
  await act(async () => resolveWrite(response({ changed: true })))
  assert.equal(refreshes, 0); assert.doesNotMatch(nodeText(screen.root), /Maria|Senha alterada/)
})
test('failed session refresh after confirmed password rotation never repeats the write', async t => {
  let writes = 0
  const { screen } = await setup(t, 'MyAccount', { sessionContext: manager, refreshSession: async () => { throw new Error('Não foi possível verificar a sessão.') } }, async () => { writes++; return response({ changed: true }) })
  await fill(screen, 'currentPassword', 'current-password-long'); await fill(screen, 'password', 'new-password-long-enough'); await submit(screen)
  assert.equal(writes, 1); assert.match(nodeText(screen.root), /Senha alterada/); assert.match(nodeText(screen.root), /Não foi possível verificar/)
})
