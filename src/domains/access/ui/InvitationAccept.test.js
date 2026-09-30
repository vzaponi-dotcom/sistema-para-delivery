import test from 'node:test'
import assert from 'node:assert/strict'
import { setup, response, fill, submit, nodeText } from '../../../test-support/accessUi.js'
test('pasted invitation accepts once then returns to login without auto session or stored token', async t => {
  const calls = [], login = []
  const { screen, h } = await setup(t, 'InvitationAccept', { onLogin: () => login.push(true) }, async (url, options) => { calls.push([url, JSON.parse(options.body)]); return response({ accepted: true }) })
  await fill(screen, 'token', 'PASTED-TOKEN'); await fill(screen, 'password', 'long-invitation-password'); await submit(screen)
  assert.deepEqual(calls, [['/api/access/invitations/accept', { token: 'PASTED-TOKEN', password: 'long-invitation-password' }]])
  assert.deepEqual(login, [true]); assert.equal(h.sessionStorage.length, 0)
  assert.doesNotMatch(nodeText(screen.root), /PASTED-TOKEN/)
})
for (const code of ['INVALID_INVITATION', 'INVITATION_EXPIRED', 'INVITATION_USED']) test(`${code} remains recoverable without navigation`, async t => {
  const { screen } = await setup(t, 'InvitationAccept', { onLogin: () => assert.fail('unexpected login') }, async () => response({ error: { code, message: 'Convite inválido ou expirado.' } }, 400))
  await fill(screen, 'token', 'INVALID'); await fill(screen, 'password', 'long-invitation-password'); await submit(screen)
  assert.match(nodeText(screen.root), /Convite inválido ou expirado/)
  assert.equal(screen.root.findByType('form').props['aria-busy'], false)
})
