import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText, buttonNamed } from '../../../test-support/renderWorkspace.js'
import { act } from 'react-test-renderer'

test('company selection displays only eligible items with role, current company and explicit choice', async t => {
  const h = await workspaceHarness(t)
  const { default: Screen } = await h.load('/src/domains/companies/ui/CompanySelection.jsx')
  const selected = []
  const renderer = await h.render(Screen, { account: { displayName: 'Ana', email: 'ana@example.test' }, items: [{ businessId: 'A', name: 'Cozinha A', roleName: 'Gerente' }, { businessId: 'B', name: 'Cozinha B', roleName: 'Operador' }], currentBusinessId: 'A', onSelect: id => selected.push(id) })
  assert.match(nodeText(renderer.root), /Cozinha A.*Gerente.*Cozinha B.*Operador/s)
  assert.deepEqual(selected, [])
  await act(async () => buttonNamed(renderer.root, 'Abrir Cozinha B').props.onClick())
  assert.deepEqual(selected, ['B'])
})
test('zero memberships offers clear empty state and logout without operational bootstrap', async t => {
  const h = await workspaceHarness(t)
  const { default: Screen } = await h.load('/src/domains/companies/ui/CompanySelection.jsx')
  let exits = 0
  const renderer = await h.render(Screen, { items: [], onLogout: () => { exits++ } })
  assert.match(nodeText(renderer.root), /Nenhuma empresa disponível/)
  await act(async () => buttonNamed(renderer.root, 'Sair da conta').props.onClick())
  assert.equal(exits, 1)
})

test('company deep link with identity scope lists eligible companies without reading any operational data', async t => {
  const h = await workspaceHarness(t)
  const calls = []
  const session = { authenticated: true, authMode: 'multi_company', scope: 'identity', contextId: 'identity-A', account: { id: 'account-A', displayName: 'Ana', email: 'ana@example.test' }, capabilities: [], platformCapabilities: [] }
  globalThis.fetch = async (path, options = {}) => {
    calls.push(path)
    assert.ok(['/api/auth/session', '/api/auth/businesses'].includes(path), `Unexpected operational request: ${path}`)
    if (path === '/api/auth/businesses') assert.equal(new Headers(options.headers).get('X-Mesiva-Context'), 'identity-A')
    return { ok: true, json: async () => path.endsWith('/session') ? session : { businesses: [] } }
  }
  const { default: App } = await h.load('/src/App.jsx')
  const { renderer, router } = await h.renderAdminApp(App, {}, { initialEntries: ['/financeiro'] })
  assert.match(nodeText(renderer.root), /Nenhuma empresa disponível/)
  assert.equal(router.state.location.pathname, '/financeiro')
  assert.ok(calls.includes('/api/auth/businesses'))
})
