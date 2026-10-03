import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText, buttonNamed } from '../../../test-support/renderWorkspace.js'
import { act } from 'react-test-renderer'
const token = 'a'.repeat(43)
const location = { pathname: '/aceitar-convite', hash: `#token=${token}`, search: '' }
const inspection = { purpose: 'company_invitation', businessName: 'Cozinha B', roleName: 'Operador', expiresAt: '2026-10-03T00:00:00Z', requiresLogin: true }
async function screen(t, props) {
  const h = await workspaceHarness(t)
  const { default: Screen } = await h.load('/src/domains/companies/ui/CompanyInvitationAccept.jsx')
  return { renderer: await h.render(Screen, props), Screen }
}

test('existing identity logs in on the invitation page, keeps token only in memory and then explicitly accepts', async t => {
  const logins = [], accepted = []
  const props = { location, history: { replaceState() {} }, api: { inspectInvitation: async () => inspection, acceptInvitation: async (input, session) => { accepted.push([input, session.contextId]); return { accepted: true } } }, onLogin: async input => { logins.push(input) } }
  const { renderer, Screen } = await screen(t, props)
  assert.match(nodeText(renderer.root), /senha atual será mantida/)
  await act(async () => renderer.root.findByProps({ autoComplete: 'username' }).props.onChange({ target: { value: 'ana@example.test' } }))
  await act(async () => renderer.root.findAllByType('input').find(node => node.props.autoComplete === 'current-password').props.onChange({ target: { value: 'existing fixture password' } }))
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.deepEqual(logins, [{ email: 'ana@example.test', password: 'existing fixture password', deviceMode: 'shared' }])
  const authenticated = { account: { id: 'account-A', email: 'ana@example.test' }, contextId: 'authenticated-A' }
  await act(async () => renderer.update((await import('react')).createElement(Screen, { ...props, session: authenticated, location: { ...location, hash: '' } })))
  assert.deepEqual(accepted, [])
  await act(async () => buttonNamed(renderer.root, 'Aceitar convite').props.onClick())
  assert.deepEqual(accepted, [[{ token }, 'authenticated-A']])
})
test('existing account invitation confirms explicitly, removes fragment before inspection and preserves existing session', async t => {
  const events = [], session = { account: { id: 'account-A', email: 'ana@example.test' }, contextId: 'A', scope: 'business', businessId: 'A' }
  const api = { inspectInvitation: async () => { events.push('inspect'); return inspection }, acceptInvitation: async (input, source) => { events.push(input); assert.equal(source, session); return { accepted: true, businessId: 'B' } } }
  const { renderer } = await screen(t, { api, session, location, history: { replaceState(_state, _unused, path) { events.push(path) } } })
  assert.deepEqual(events, ['/aceitar-convite', 'inspect'])
  assert.equal(renderer.root.findAllByType('input').filter(n => n.props.type === 'password').length, 0)
  await act(async () => buttonNamed(renderer.root, 'Aceitar convite').props.onClick())
  assert.deepEqual(events[2], { token })
  assert.equal(session.businessId, 'A')
  assert.match(nodeText(renderer.root), /Acesso confirmado/)
  assert.doesNotMatch(nodeText(renderer.root), new RegExp(token))
})
test('new account invitation creates password; an existing identity asks for email login instead', async t => {
  const { renderer } = await screen(t, { api: { inspectInvitation: async () => ({ ...inspection, requiresLogin: false }), acceptInvitation: async () => ({ accepted: true }) }, location, history: { replaceState() {} } })
  assert.equal(renderer.root.findAllByType('input').filter(n => n.props.type === 'password').length, 2)
})
test('inspection superseded by another session cannot publish old invitation metadata', async t => {
  let resolveOld
  const api = { inspectInvitation: async () => new Promise(resolve => { resolveOld = resolve }), acceptInvitation: async () => assert.fail('not ready') }
  const props = { api, location, history: { replaceState() {} }, session: { contextId: 'A' } }
  const { renderer, Screen } = await screen(t, props)
  const old = resolveOld
  await act(async () => renderer.update((await import('react')).createElement(Screen, { ...props, session: { contextId: 'B' } })))
  await act(async () => old({ ...inspection, businessName: 'Old private name' }))
  assert.doesNotMatch(nodeText(renderer.root), /Old private name/)
})
