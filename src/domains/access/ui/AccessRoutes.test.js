import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'
import { response, users, roles, act } from '../../../test-support/accessUi.js'
import { resolveDestination } from '../../../app/navigation/resolution.js'

test('access-only grants enroll through Settings parent independently of operational settings', () => {
  assert.equal(resolveDestination('settings-home', new Set(['access.users.view']), new Set(['settings-home'])).status, 'allowed')
})
test('public activation renders before anonymous login without fetching session or token from URL', async t => {
  const h = await workspaceHarness(t)
  globalThis.fetch = () => assert.fail('activation has no authenticated runtime')
  const { default: App } = await h.load('/src/App.jsx')
  const { renderer } = await h.renderAdminApp(App, {}, { initialEntries: ['/ativar-conta?token=URL-SECRET'] })
  assert.match(nodeText(renderer.root), /Ativar conta/)
  assert.equal(renderer.root.findAllByType('input').some(n => n.props.name === 'token'),false)
  assert.match(nodeText(renderer.root),/Abra novamente.*e-mail/)
  assert.doesNotMatch(nodeText(renderer.root), /URL-SECRET/)
})
for(const path of ['/recuperar-senha','/redefinir-senha'])test(`public ${path} precedes the authenticated runtime`,async t=>{
  const h=await workspaceHarness(t)
  globalThis.fetch=()=>assert.fail('public page must not discover or revoke a session')
  const {default:App}=await h.load('/src/App.jsx')
  const {renderer}=await h.renderAdminApp(App,{}, {initialEntries:[path]})
  assert.match(nodeText(renderer.root),path==='/recuperar-senha'?/Recuperar senha/:/Criar nova senha/)
})
test('enrollment actual App composes the permitted team and account screens without bootstrap', async t => {
  const h = await workspaceHarness(t)
  const requests = []
  globalThis.fetch = async url => {
    requests.push(url)
    if (url === '/api/auth/session') return response({ authenticated: true, authMode: 'enrollment', operationalAccess: false, businessId: 'b', settingsContextId: 'c', user: { id: 'm', displayName: 'Maria' }, capabilities: ['access.users.view', 'access.users.manage'] })
    if (url === '/api/access/users') return response({ users, roles })
    assert.fail(`unexpected enrollment request ${url}`)
  }
  const { default: App } = await h.load('/src/App.jsx')
  const { renderer, router } = await h.renderAdminApp(App, {}, { initialEntries: ['/configuracoes/equipe'] })
  assert.match(nodeText(renderer.root), /Contas da equipe/)
  await act(async () => router.navigate('/minha-conta'))
  assert.match(nodeText(renderer.root), /Alterar minha senha/)
  assert.equal(requests.includes('/api/bootstrap'), false)
})
test('enrollment with operational grants still exposes only account and access pages', async t => {
  const h = await workspaceHarness(t)
  globalThis.fetch = async url => {
    if (url === '/api/auth/session') return response({ authenticated: true, authMode: 'enrollment', businessId: 'b', settingsContextId: 'c', user: { id: 'm', displayName: 'Maria' }, capabilities: ['orders.view', 'orders.create', 'clients.view', 'access.users.view', 'access.users.manage'] })
    if (url === '/api/access/users') return response({ users, roles })
    assert.fail(`operational enrollment read ${url}`)
  }
  const { default: App } = await h.load('/src/App.jsx')
  const { renderer, router } = await h.renderAdminApp(App, {}, { initialEntries: ['/pedidos'] })
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Pedidos, área principal' }).length, 0)
  assert.ok(['/configuracoes', '/configuracoes/equipe'].includes(router.state.location.pathname))
  assert.match(nodeText(renderer.root), /Equipe e acessos/)
})
for (const path of ['/configuracoes/equipe', '/configuracoes/atividades']) test(`operator direct ${path} never reads protected content`, async t => {
  const h = await workspaceHarness(t)
  globalThis.fetch = async url => {
    if (url === '/api/auth/session') return response({ authenticated: true, authMode: 'enrollment', operationalAccess: false, businessId: 'b', settingsContextId: 'c', user: { id: 'o', displayName: 'Otávio' }, capabilities: [] })
    assert.fail(`forbidden read ${url}`)
  }
  const { default: App } = await h.load('/src/App.jsx')
  const { renderer } = await h.renderAdminApp(App, {}, { initialEntries: [path] })
  assert.doesNotMatch(nodeText(renderer.root), /Contas da equipe|Ações registradas pelo servidor/)
})
