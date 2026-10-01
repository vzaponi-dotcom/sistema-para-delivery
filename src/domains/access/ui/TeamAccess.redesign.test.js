import test from 'node:test'
import assert from 'node:assert/strict'
import { setup, manager, users, roles, response, fill, submit, act, nodeText, buttonNamed } from '../../../test-support/accessUi.js'

test('explicit invite defaults to operator and closing its result never reveals the code again', async t => {
  const writes = []
  const { screen } = await setup(t, 'TeamAccess', { sessionContext: manager }, async (_url, options = {}) => {
    if (!options.method) return response({ users, roles })
    writes.push(JSON.parse(options.body))
    return response({ user: { ...users[1], id: 'new', displayName: 'Ana', identifier: 'ana', credentialState: 'invited' }, invite: { token: 'DEMO-ONE-USE', expiresAt: '2026-10-02' } })
  })
  assert.equal(screen.root.findAllByType('form').length, 0)
  assert.ok(buttonNamed(screen.root, 'Convidar pessoa'))
  await act(async () => buttonNamed(screen.root, 'Convidar pessoa').props.onClick())
  await fill(screen, 'displayName', 'Ana'); await fill(screen, 'identifier', 'ana'); await submit(screen)
  assert.deepEqual(writes, [{ displayName: 'Ana', identifier: 'ana', roleId: 'operator' }])
  assert.match(nodeText(screen.root), /DEMO-ONE-USE/)
  assert.match(nodeText(screen.root), /ana/)
  await act(async () => buttonNamed(screen.root, 'Fechar convite').props.onClick())
  await act(async () => buttonNamed(screen.root, 'Convidar pessoa').props.onClick())
  assert.doesNotMatch(nodeText(screen.root), /DEMO-ONE-USE/)
})

test('team filters names locally and requires confirmation before a reset write', async t => {
  let writes = 0, reads = 0
  const { screen } = await setup(t, 'TeamAccess', { sessionContext: manager }, async (_url, options = {}) => {
    if (!options.method) { reads++; return response({ users, roles }) }
    writes++; return response({ user: { ...users[1], credentialState: 'reset_pending' }, invite: { token: 'DEMO-RESET', expiresAt: '2026-10-02' } })
  })
  assert.ok(screen.root.findAllByType('input').some(n => n.props.name === 'search'), 'local search available')
  await fill(screen, 'search', 'OTÁVIO')
  const list = () => screen.root.findByProps({ 'aria-label': 'Contas da equipe' })
  assert.match(nodeText(list()), /Otávio/); assert.doesNotMatch(nodeText(list()), /Maria/)
  assert.equal(reads, 1)
  await act(async () => buttonNamed(screen.root, 'Redefinir senha de Otávio').props.onClick())
  assert.equal(writes, 0)
  await act(async () => buttonNamed(screen.root, 'Cancelar').props.onClick())
  assert.equal(writes, 0)
  await act(async () => buttonNamed(screen.root, 'Redefinir senha de Otávio').props.onClick())
  await act(async () => buttonNamed(screen.root, 'Confirmar redefinição').props.onClick())
  assert.equal(writes, 1)
})

test('the only manager with usable credentials cannot be deactivated from the list', async t => {
  const { screen } = await setup(t, 'TeamAccess', { sessionContext: manager }, async () => response({ users, roles }))
  assert.equal(buttonNamed(screen.root, 'Desativar Maria').props.disabled, true)
  await act(async () => buttonNamed(screen.root, 'Desativar Maria').props.onClick())
  assert.equal(screen.root.findAllByProps({ role: 'dialog' }).length, 0)
})
