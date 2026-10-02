import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'
import { act } from 'react-test-renderer'

for (const granted of [true, false]) test(`platform entry selects official scope only with grant: ${granted}`, async t => {
  const h = await workspaceHarness(t), calls = []
  let session = { authenticated: true, authMode: 'multi_company', scope: 'business', contextId: 'business-A', businessId: 'A', settingsContextId: 'A', account: { id: 'admin', displayName: 'Admin', email: 'admin@example.test' }, user: { id: 'member' }, capabilities: [], platformCapabilities: granted ? ['platform.businesses.view'] : [] }
  globalThis.fetch = async (path, options = {}) => {
    calls.push(path)
    assert.ok(['/api/auth/session', '/api/auth/select-platform', '/api/platform/businesses?limit=20'].includes(path), `Operational request: ${path}`)
    if (path === '/api/auth/select-platform') { assert.equal(new Headers(options.headers).get('X-Mesiva-Context'), 'business-A'); session = { ...session, scope: 'platform', contextId: 'platform-A', businessId: undefined, user: undefined }; return { ok: true, json: async () => ({}) } }
    return { ok: true, json: async () => path === '/api/auth/session' ? session : { items: [], nextCursor: null } }
  }
  const { default: App } = await h.load('/src/App.jsx')
  const { renderer } = await h.renderAdminApp(App, {}, { initialEntries: ['/mesiva'] })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)) })
  assert.match(nodeText(renderer.root), granted ? /Empresas/ : /Você não tem acesso ao painel Mesiva/)
  assert.equal(calls.filter(path => path === '/api/auth/select-platform').length, granted ? 1 : 0)
  assert.equal(calls.some(path => path.startsWith('/api/platform/')), granted)
})
test('ordinary manager cannot render platform routes or start their fetches', async t => {
  const h = await workspaceHarness(t), { default: Routes } = await h.load('/src/domains/platform/ui/PlatformRoutes.jsx')
  const renderer = await h.render(Routes, { session: { authenticated: true, scope: 'business', capabilities: ['access.users.manage'], platformCapabilities: ['platform.businesses.view'] }, path: '/mesiva/empresas', api: { listBusinesses: () => assert.fail('forbidden fetch') } })
  assert.match(nodeText(renderer.root), /Você não tem acesso ao painel Mesiva/)
})
