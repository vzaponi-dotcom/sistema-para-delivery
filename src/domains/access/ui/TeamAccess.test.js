import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { setup, manager, users, roles, response, fill, submit, act, nodeText, buttonNamed } from '../../../test-support/accessUi.js'

test('global company team offers personal recovery guidance and resends pending memberships of verified accounts', async t => {
  const pending = { ...users[1], credentialState: 'invited', membershipState: 'invited', emailVerified: true }
  const sessionContext = { ...manager, authMode: 'multi_company', account: { id: 'account-manager' } }
  const { screen } = await setup(t, 'TeamAccess', { sessionContext }, async () => response({ users: [users[0], pending], roles }))
  await act(async () => screen.root.findByProps({ 'aria-label': `Ações de ${pending.displayName}` }).props.onClick({ preventDefault() {} }))
  assert.ok(buttonNamed(screen.root, `Reenviar convite para ${pending.displayName}`))
  assert.equal(buttonNamed(screen.root, `Redefinir senha de ${pending.displayName}`), undefined)
  assert.match(nodeText(screen.root), /Esqueci minha senha/)
})

for(const status of ['accepted','rejected','uncertain'])test(`email invitation reports ${status} honestly and offers resend without exposing a token`,async t=>{
  const requests=[],pending={...users[1],id:'pending',email:'ana@example.test',emailVerified:false,credentialState:'invited'}
  const {screen}=await setup(t,'TeamAccess',{sessionContext:manager},async(url,options={})=>{
    if(!options.method)return response({users,roles})
    requests.push([url,options.body&&JSON.parse(options.body)])
    return response({user:pending,delivery:{status,expiresAt:'2026-10-03'},invite:{token:'UNEXPECTED-SECRET'}})
  })
  await act(async()=>buttonNamed(screen.root,'Convidar pessoa').props.onClick())
  await fill(screen,'displayName','Ana');await fill(screen,'email','ana@example.test');await submit(screen)
  assert.deepEqual(requests[0][1],{displayName:'Ana',email:'ana@example.test',roleId:'operator'})
  const expected={accepted:/serviço aceitou o envio/i,rejected:/serviço rejeitou o envio/i,uncertain:/Não foi possível confirmar o envio/i}
  assert.match(nodeText(screen.root),expected[status]);assert.doesNotMatch(nodeText(screen.root),/UNEXPECTED-SECRET|Copiar código|Código de ativação/)
  await act(async()=>buttonNamed(screen.root,'Fechar').props.onClick())
  await act(async()=>buttonNamed(screen.root,'Reenviar convite para Otávio').props.onClick())
  assert.equal(requests[1][0],'/api/access/users/pending/resend-invite')
})
test('email remains read-only and unverified or recovering managers are counted correctly',async t=>{
  const list=[{...users[0],emailVerified:true,passwordRecoveryPending:true},{...users[0],id:'pending-manager',emailVerified:false}]
  const {screen}=await setup(t,'TeamAccess',{sessionContext:manager},async()=>response({users:list,roles}))
  assert.equal(buttonNamed(screen.root,'Desativar conta de Maria').props.disabled,true)
  await act(async()=>buttonNamed(screen.root,'Editar Maria').props.onClick())
  const email=screen.root.findAllByType('input').find(n=>n.props.name==='email')
  assert.equal(email.props.readOnly,true)
})

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
  await act(async () => buttonNamed(screen.root, 'Convidar pessoa').props.onClick())
  await fill(screen, 'displayName', 'Nova'); await fill(screen, 'email', 'nova@example.test')
  await choose('Operador'); await submit(screen)
  assert.equal(writes[0].roleId, 'operator')
  await act(async () => buttonNamed(screen.root, 'Editar Otávio').props.onClick())
  const modal = () => screen.root.findByProps({ role: 'dialog' })
  await act(async () => modal().findByProps({ role: 'combobox', 'aria-label': 'Perfil' }).props.onClick())
  await act(async () => modal().findAllByProps({ role: 'option' }).find(option => nodeText(option) === 'Gerente').props.onClick())
  await act(async () => buttonNamed(screen.root, 'Salvar conta').props.onClick())
  assert.equal(writes[1].roleId, 'manager')
  await act(async () => buttonNamed(screen.root, 'Convidar pessoa').props.onClick())
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
test('manager creates an email invitation once and dismisses delivery feedback without exposing tokens', async t => {
  const calls = []
  const { screen } = await setup(t, 'TeamAccess', { sessionContext: manager }, async (url, options = {}) => {
    calls.push([url, options])
    return response(options.method === 'POST' ? { user: { ...users[1], id: 'new', credentialState: 'invited' }, delivery:{status:'accepted',expiresAt:'2026-10-03'},invite: { token: 'ONE-USE-SECRET', expiresAt: '2026-10-01' } } : { users, roles })
  })
  await act(async () => buttonNamed(screen.root, 'Convidar pessoa').props.onClick())
  await fill(screen, 'displayName', 'Nova pessoa'); await fill(screen, 'email', 'nova@example.test')
  await submit(screen)
  assert.doesNotMatch(nodeText(screen.root), /ONE-USE-SECRET/)
  const payload = JSON.parse(calls.find(([,o]) => o.method === 'POST')[1].body)
  assert.deepEqual(payload, { displayName: 'Nova pessoa', email: 'nova@example.test', roleId: 'operator' })
  await act(async () => buttonNamed(screen.root, 'Fechar').props.onClick())
  assert.doesNotMatch(nodeText(screen.root), /ONE-USE-SECRET/)
  assert.equal(screen.root.findAllByType('input').some(n => n.props.name === 'capabilities'), false)
})
test('last manager conflict preserves users; other-user reset reports email delivery', async t => {
  const calls = []
  const { screen } = await setup(t, 'TeamAccess', { sessionContext: manager }, async (url, options = {}) => {
    calls.push([url, options])
    if (options.method === 'PATCH') return response({ error: { code: 'LAST_MANAGER', message: 'Mantenha pelo menos um gerente ativo.' } }, 409)
    if (options.method === 'POST') return response({ user: { ...users[1], credentialState: 'active',passwordRecoveryPending:true }, delivery:{status:'accepted',expiresAt:'2026-10-03'},invite: { token: 'RESET-ONCE', expiresAt: '2026-10-01' } })
    return response({ users: [...users, { ...users[0], id: 'second-manager', displayName: 'Segundo gerente' }], roles })
  })
  await act(async () => buttonNamed(screen.root, 'Desativar conta de Maria').props.onClick())
  await act(async () => buttonNamed(screen.root, 'Confirmar desativação').props.onClick())
  assert.match(nodeText(screen.root), /Mantenha pelo menos um gerente/)
  assert.ok(buttonNamed(screen.root, 'Desativar conta de Maria'))
  assert.equal(buttonNamed(screen.root, 'Redefinir senha de Maria'), undefined)
  await act(async () => buttonNamed(screen.root, 'Cancelar').props.onClick())
  await act(async () => buttonNamed(screen.root, 'Redefinir senha de Otávio').props.onClick())
  await act(async () => buttonNamed(screen.root, 'Confirmar redefinição').props.onClick())
  assert.doesNotMatch(nodeText(screen.root), /RESET-ONCE/)
  assert.equal(calls.filter(([,o]) => o.method === 'POST').length, 1)
})
test('changed owner masks old users on first render and rejects a delayed invite result', async t => {
  let resolveCreate
  const { screen, Component } = await setup(t, 'TeamAccess', { sessionContext: manager }, async (_url, options = {}) => options.method === 'POST' ? new Promise(resolve => { resolveCreate = resolve }) : response({ users, roles }))
  await act(async () => buttonNamed(screen.root, 'Convidar pessoa').props.onClick())
  await fill(screen, 'displayName', 'Pessoa'); await fill(screen, 'email', 'pessoa@example.test')
  await act(async () => { screen.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
  await act(async () => screen.update(React.createElement(Component, { sessionContext: { user: { id: 'o' }, capabilities: [] } })))
  assert.doesNotMatch(nodeText(screen.root), /Maria|Otávio/)
  await act(async () => resolveCreate(response({ user: users[1], delivery:{status:'accepted',expiresAt:'2026-10-03'},invite: { token: 'STALE-SECRET' } })))
  assert.doesNotMatch(nodeText(screen.root), /STALE-SECRET/)
})
test('refresh cannot replay a create or resurface its dismissed invitation', async t => {
  let creates = 0
  const { screen } = await setup(t, 'TeamAccess', { sessionContext: manager }, async (_url, options = {}) => {
    if (options.method === 'POST') { creates++; return response({ user: { ...users[1], id: 'new' }, delivery:{status:'accepted',expiresAt:'2026-10-03'},invite: { token: 'VISIBLE-ONCE', expiresAt: '2026-10-01' } }) }
    return response({ users, roles })
  })
  await act(async () => buttonNamed(screen.root, 'Convidar pessoa').props.onClick())
  await fill(screen, 'displayName', 'Nova'); await fill(screen, 'email', 'nova@example.test'); await submit(screen)
  await act(async () => buttonNamed(screen.root, 'Fechar').props.onClick())
  await act(async () => buttonNamed(screen.root, 'Atualizar equipe').props.onClick())
  assert.equal(creates, 1); assert.doesNotMatch(nodeText(screen.root), /VISIBLE-ONCE/)
})
test('view-only grant exposes immutable summaries but no manager controls', async t => {
  const { screen } = await setup(t, 'TeamAccess', { sessionContext: { ...manager, capabilities: ['access.users.view'] } }, async () => response({ users, roles }))
  assert.match(nodeText(screen.root), /Otávio|clients.create/)
  assert.equal(screen.root.findAllByType('form').length, 0)
  assert.equal(buttonNamed(screen.root, 'Desativar conta de Maria'), undefined)
})
test('callback-only parent render does not repeat the team read', async t => {
  let reads = 0
  const { screen, Component } = await setup(t, 'TeamAccess', { sessionContext: manager, onApiError() {} }, async () => { reads++; return response({ users, roles }) })
  await act(async () => screen.update(React.createElement(Component, { sessionContext: manager, onApiError() {} })))
  assert.equal(reads, 1); assert.match(nodeText(screen.root), /Otávio/)
})

test('role summaries present Portuguese permissions and a readable future fallback', async t => {
  const { screen } = await setup(t, 'TeamAccess', { sessionContext: manager }, async () => response({ users, roles: [{ ...roles[0], capabilities: ['finance.promises.manage', 'future.new_permission'] }] }))
  assert.match(nodeText(screen.root), /Gerenciar promessas de pagamento/)
  assert.match(nodeText(screen.root), /Future new permission/)
  assert.doesNotMatch(nodeText(screen.root), /finance\.promises\.manage/)
})
