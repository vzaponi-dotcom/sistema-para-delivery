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
  assert.equal(buttonNamed(screen.root, 'Desativar conta de Maria').props.disabled, true)
  await act(async () => buttonNamed(screen.root, 'Desativar conta de Maria').props.onClick())
  assert.equal(screen.root.findAllByProps({ role: 'dialog' }).length, 0)
})

test('opening another person actions closes the previous menu and dismissal leaves none open', async t => {
  const { h, screen } = await setup(t, 'TeamAccess', { sessionContext: manager }, async () => response({ users, roles }))
  const trigger = name => screen.root.findAllByType('summary').find(node => node.props['aria-label'] === `Ações de ${name}`)
  const open = () => screen.root.findAllByType('details').filter(node => node.props.className === 'access-row-menu' && node.props.open)
  await act(async () => trigger('Maria').props.onClick?.({ preventDefault() {} }))
  assert.equal(open().length, 1)
  await act(async () => trigger('Otávio').props.onClick?.({ preventDefault() {} }))
  assert.equal(open().length, 1)
  assert.equal(open()[0].findByType('summary').props['aria-label'], 'Ações de Otávio')
  await act(async () => h.document.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' })))
  assert.equal(open().length, 0)
  await act(async () => trigger('Otávio').props.onClick?.({ preventDefault() {} }))
  await act(async () => h.document.dispatchEvent(new Event('mousedown')))
  assert.equal(open().length, 0)
  await act(async () => trigger('Otávio').props.onClick?.({ preventDefault() {} }))
  await act(async () => buttonNamed(screen.root, 'Redefinir senha de Otávio').props.onClick())
  assert.equal(open().length, 0)
  assert.ok(buttonNamed(screen.root, 'Confirmar redefinição'))
})

test('long person names appear once in the action context instead of expanding every action label', async t => {
  const longName = '[TESTE ISSUE44] Concorrencia temporaria'
  const { screen } = await setup(t, 'TeamAccess', { sessionContext: manager }, async () => response({ users: [users[0], { ...users[1], displayName: longName, active: false }], roles }))
  const action = buttonNamed(screen.root, `Ativar conta de ${longName}`)
  assert.ok(action, 'accessible action retains its target identity')
  assert.doesNotMatch(nodeText(action), /TESTE ISSUE44/)
  const menu = action.parent.parent
  assert.match(nodeText(menu), /\[TESTE ISSUE44\] Concorrencia temporaria/)
  for (const button of menu.findAllByType('button')) assert.ok(nodeText(button).length <= 22, 'actions remain compact with a long target name')
})

test('clearing a search does not reopen the menu of a previously filtered person', async t => {
  const { screen } = await setup(t, 'TeamAccess', { sessionContext: manager }, async () => response({ users, roles }))
  const trigger = () => screen.root.findAllByType('summary').find(node => node.props['aria-label'] === 'Ações de Otávio')
  const open = () => screen.root.findAllByType('details').filter(node => node.props.className === 'access-row-menu' && node.props.open)
  await act(async () => trigger().props.onClick({ preventDefault() {} }))
  assert.equal(open().length, 1)
  await fill(screen, 'search', 'Maria')
  assert.equal(open().length, 0)
  await fill(screen, 'search', '')
  assert.equal(open().length, 0)
})

test('action accessible names include the displayed label and target person', async t => {
  const { screen } = await setup(t, 'TeamAccess', { sessionContext: manager }, async () => response({ users, roles }))
  const menu = screen.root.findAllByProps({ className: 'access-row-menu' })[1]
  for (const button of menu.findAllByType('button')) {
    assert.ok(button.props['aria-label'].includes(nodeText(button)), 'visible action is part of its accessible name')
    assert.match(button.props['aria-label'], /Otávio/)
  }
})
