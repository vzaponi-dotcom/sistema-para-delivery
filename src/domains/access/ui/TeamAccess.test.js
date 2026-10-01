import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { setup, manager, users, roles, response, fill, submit, act, nodeText, buttonNamed } from '../../../test-support/accessUi.js'

test('role selection uses the shared control for invitation and editing and blocks writes', async t => {
  const writes = []
  const { screen, Component } = await setup(t, 'TeamAccess', { sessionContext: manager }, async (_url, options = {}) => {
    if (options.method) {
      const body = JSON.parse(options.body); writes.push(body)
      return response({ user: { ...users[1], ...(options.method === 'POST' ? { id: 'new', displayName: 'Nova' } : {}), roleId: body.roleId } })
    }
    return response({ users, roles })
  })
  const choose = async (label) => {
    await act(async () => screen.root.findByProps({ role: 'combobox', 'aria-label': 'Perfil' }).props.onClick())
    await act(async () => screen.root.findAllByProps({ role: 'option' }).find(option => nodeText(option) === label).props.onClick())
  }
  await fill(screen, 'displayName', 'Nova'); await fill(screen, 'identifier', 'nova')
  await choose('Operador'); await submit(screen)
  assert.equal(writes[0].roleId, 'operator')
  await act(async () => buttonNamed(screen.root, 'Editar Otávio').props.onClick())
  const modal = () => screen.root.findByProps({ role: 'dialog' })
  await act(async () => modal().findByProps({ role: 'combobox', 'aria-label': 'Perfil' }).props.onClick())
  await act(async () => modal().findAllByProps({ role: 'option' }).find(option => nodeText(option) === 'Gerente').props.onClick())
  await act(async () => buttonNamed(screen.root, 'Salvar conta').props.onClick())
  assert.equal(writes[1].roleId, 'manager')
  await act(async () => screen.update(React.createElement(Component, { sessionContext: manager, writesBlocked: true })))
  assert.equal(screen.root.findByProps({ role: 'combobox', 'aria-label': 'Perfil' }).props.disabled, true)
  assert.equal(buttonNamed(screen.root, 'Editar Otávio').props.disabled, true)
  await submit(screen)
  assert.equal(writes.length, 2)
})

test('team denies an operator before reading or rendering private users', async t => {
  const { screen } = await setup(t, 'TeamAccess', { sessionContext: { user: { id: 'o' }, capabilities: [] } }, () => assert.fail('denied read'))
  assert.match(nodeText(screen.root), /Acesso negado/)
  assert.equal(screen.root.findAllByType('form').length, 0)
})
test('manager creates an invitation once and dismisses it without revealing stored tokens', async t => {
  const calls = []
  const { screen } = await setup(t, 'TeamAccess', { sessionContext: manager }, async (url, options = {}) => {
    calls.push([url, options])
    return response(options.method === 'POST' ? { user: { ...users[1], id: 'new', credentialState: 'invited' }, invite: { token: 'ONE-USE-SECRET', expiresAt: '2026-10-01' } } : { users, roles })
  })
  await fill(screen, 'displayName', 'Nova pessoa'); await fill(screen, 'identifier', 'nova')
  await submit(screen)
  assert.match(nodeText(screen.root), /ONE-USE-SECRET/)
  const payload = JSON.parse(calls.find(([,o]) => o.method === 'POST')[1].body)
  assert.deepEqual(payload, { displayName: 'Nova pessoa', identifier: 'nova', roleId: 'manager' })
  await act(async () => buttonNamed(screen.root, 'Fechar convite').props.onClick())
  assert.doesNotMatch(nodeText(screen.root), /ONE-USE-SECRET/)
  assert.equal(screen.root.findAllByType('input').some(n => n.props.name === 'capabilities'), false)
})
test('last manager conflict preserves authoritative users; other-user reset returns an ephemeral token', async t => {
  const calls = []
  const { screen } = await setup(t, 'TeamAccess', { sessionContext: manager }, async (url, options = {}) => {
    calls.push([url, options])
    if (options.method === 'PATCH') return response({ error: { code: 'LAST_MANAGER', message: 'Mantenha pelo menos um gerente ativo.' } }, 409)
    if (options.method === 'POST') return response({ user: { ...users[1], credentialState: 'reset_pending' }, invite: { token: 'RESET-ONCE', expiresAt: '2026-10-01' } })
    return response({ users, roles })
  })
  await act(async () => buttonNamed(screen.root, 'Desativar Maria').props.onClick())
  assert.match(nodeText(screen.root), /Mantenha pelo menos um gerente/)
  assert.ok(buttonNamed(screen.root, 'Desativar Maria'))
  assert.equal(buttonNamed(screen.root, 'Redefinir senha de Maria'), undefined)
  await act(async () => buttonNamed(screen.root, 'Redefinir senha de Otávio').props.onClick())
  assert.match(nodeText(screen.root), /RESET-ONCE/)
  assert.equal(calls.filter(([,o]) => o.method === 'POST').length, 1)
})
test('changed owner masks old users on first render and rejects a delayed invite result', async t => {
  let resolveCreate
  const { screen, Component } = await setup(t, 'TeamAccess', { sessionContext: manager }, async (_url, options = {}) => options.method === 'POST' ? new Promise(resolve => { resolveCreate = resolve }) : response({ users, roles }))
  await fill(screen, 'displayName', 'Pessoa'); await fill(screen, 'identifier', 'pessoa')
  await act(async () => { screen.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
  await act(async () => screen.update(React.createElement(Component, { sessionContext: { user: { id: 'o' }, capabilities: [] } })))
  assert.doesNotMatch(nodeText(screen.root), /Maria|Otávio/)
  await act(async () => resolveCreate(response({ user: users[1], invite: { token: 'STALE-SECRET' } })))
  assert.doesNotMatch(nodeText(screen.root), /STALE-SECRET/)
})
test('refresh cannot replay a create or resurface its dismissed invitation', async t => {
  let creates = 0
  const { screen } = await setup(t, 'TeamAccess', { sessionContext: manager }, async (_url, options = {}) => {
    if (options.method === 'POST') { creates++; return response({ user: { ...users[1], id: 'new' }, invite: { token: 'VISIBLE-ONCE', expiresAt: '2026-10-01' } }) }
    return response({ users, roles })
  })
  await fill(screen, 'displayName', 'Nova'); await fill(screen, 'identifier', 'nova'); await submit(screen)
  await act(async () => buttonNamed(screen.root, 'Fechar convite').props.onClick())
  await act(async () => buttonNamed(screen.root, 'Atualizar equipe').props.onClick())
  assert.equal(creates, 1); assert.doesNotMatch(nodeText(screen.root), /VISIBLE-ONCE/)
})
test('view-only grant exposes immutable summaries but no manager controls', async t => {
  const { screen } = await setup(t, 'TeamAccess', { sessionContext: { ...manager, capabilities: ['access.users.view'] } }, async () => response({ users, roles }))
  assert.match(nodeText(screen.root), /Otávio|clients.create/)
  assert.equal(screen.root.findAllByType('form').length, 0)
  assert.equal(buttonNamed(screen.root, 'Desativar Maria'), undefined)
})
test('callback-only parent render does not repeat the team read', async t => {
  let reads = 0
  const { screen, Component } = await setup(t, 'TeamAccess', { sessionContext: manager, onApiError() {} }, async () => { reads++; return response({ users, roles }) })
  await act(async () => screen.update(React.createElement(Component, { sessionContext: manager, onApiError() {} })))
  assert.equal(reads, 1); assert.match(nodeText(screen.root), /Otávio/)
})
