import test from 'node:test'
import assert from 'node:assert/strict'
import { setup, manager, response, fill, submit, act, nodeText, buttonNamed } from '../../../test-support/accessUi.js'
import { workspaceHarness } from '../../../test-support/renderWorkspace.js'

test('login reveals password without changing credentials and links to token-free activation', async t => {
  const h = await workspaceHarness(t)
  const { default: LoginScreen } = await h.load('/src/app/shell/LoginScreen.jsx')
  const writes = []
  const screen = await h.render(LoginScreen, { authMode: 'user_only', onLogin: value => writes.push(value) })
  const input = autocomplete => screen.root.findAllByType('input').find(n => n.props.autoComplete === autocomplete)
  await act(async () => { input('username').props.onChange({ target: { value: 'ana' } }); input('current-password').props.onChange({ target: { value: ' spaces preserved ' } }) })
  assert.ok(buttonNamed(screen.root, 'Mostrar senha'), 'password visibility control is available')
  await act(async () => buttonNamed(screen.root, 'Mostrar senha').props.onClick())
  assert.equal(input('current-password').props.type, 'text')
  assert.equal(input('current-password').props.value, ' spaces preserved ')
  assert.equal(screen.root.findAllByType('a').find(n => nodeText(n) === 'Tenho um convite').props.href, '/ativar-conta')
  await submit(screen)
  assert.deepEqual(writes, [{ identifier: 'ana', password: ' spaces preserved ', deviceMode: 'shared' }])
  assert.equal(input('current-password').props.value, '')
})

test('activation validates confirmation before the API and shows explicit login after clearing secrets', async t => {
  const writes = [], logins = []
  const { screen } = await setup(t, 'InvitationAccept', { onLogin: () => logins.push(true) }, async (_url, options) => { writes.push(JSON.parse(options.body)); return response({ accepted: true }) })
  await fill(screen, 'token', ' DEMO-CODE ')
  await fill(screen, 'password', 'new-password-long-enough')
  assert.ok(screen.root.findAllByType('input').some(n => n.props.name === 'confirmPassword'), 'activation asks for password confirmation')
  await fill(screen, 'confirmPassword', 'different-password-long')
  await submit(screen)
  assert.equal(writes.length, 0)
  assert.match(nodeText(screen.root.findByProps({ role: 'alert' })), /senhas não coincidem/i)
  await fill(screen, 'confirmPassword', 'new-password-long-enough')
  await submit(screen)
  assert.deepEqual(writes, [{ token: 'DEMO-CODE', password: 'new-password-long-enough' }])
  assert.equal(screen.root.findAllByType('input').length, 0)
  assert.equal(logins.length, 0)
  assert.match(nodeText(screen.root), /ativada com sucesso/i)
  await act(async () => buttonNamed(screen.root, 'Ir para o login').props.onClick())
  assert.deepEqual(logins, [true])
})

test('own password mismatch never reaches the trusted credential coordinator', async t => {
  let coordinated = 0
  const { screen } = await setup(t, 'MyAccount', { sessionContext: manager, runCredentialChange: async operation => { coordinated++; return operation() } }, async () => response({ changed: true }))
  await fill(screen, 'currentPassword', 'current-password-long')
  await fill(screen, 'password', 'new-password-long-enough')
  assert.ok(screen.root.findAllByType('input').some(n => n.props.name === 'confirmPassword'), 'account asks for password confirmation')
  await fill(screen, 'confirmPassword', 'different-password-long')
  await submit(screen)
  assert.equal(coordinated, 0)
  assert.match(nodeText(screen.root), /senhas não coincidem/i)
  await fill(screen, 'confirmPassword', 'new-password-long-enough')
  await submit(screen)
  assert.equal(coordinated, 1)
  assert.equal(screen.root.findAllByType('input').every(n => n.props.value === ''), true)
})
