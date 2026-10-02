import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText, buttonNamed } from '../../../test-support/renderWorkspace.js'
import { act } from 'react-test-renderer'

test('uncertain administrative creation blocks browser navigation and logout until the same receipt is reconciled', async t => {
  const h = await workspaceHarness(t), calls = [], attempts = []
  const session = { authenticated: true, authMode: 'multi_company', scope: 'platform', contextId: 'platform-A', account: { id: 'admin', displayName: 'Administrator', email: 'admin@example.test' }, capabilities: [], platformCapabilities: ['platform.businesses.view', 'platform.businesses.create'] }
  globalThis.fetch = async (path, options = {}) => {
    calls.push(path)
    if (path === '/api/auth/session') return { ok: true, json: async () => session }
    assert.equal(new Headers(options.headers).get('X-Mesiva-Context'), 'platform-A')
    if (path === '/api/platform/businesses' && options.method === 'POST') { attempts.push([new Headers(options.headers).get('Idempotency-Key'), JSON.parse(options.body)]); if (attempts.length === 1) throw new Error('lost body'); return { ok: true, json: async () => ({ businessId: 'new-A', created: false }) } }
    if (path === '/api/platform/businesses/new-A') return { ok: true, json: async () => ({ id: 'new-A', name: 'Company A', accessStatus: 'pending', history: [] }) }
    assert.fail(`Unexpected request: ${path}`)
  }
  const { default: App } = await h.load('/src/App.jsx')
  const { renderer, router } = await h.renderAdminApp(App, {}, { initialEntries: ['/mesiva/empresas/nova'] })
  for (const [name, value] of Object.entries({ name: 'Company A', managerName: 'Ana', managerEmail: 'ana@example.test' })) await act(async () => renderer.root.findAllByType('input').find(node => node.props.name === name).props.onChange({ target: { value } }))
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  await act(async () => buttonNamed(renderer.root, 'Criar empresa e enviar convite').props.onClick())
  assert.equal(buttonNamed(renderer.root, 'Sair').props.disabled, true)
  await act(async () => { void router.navigate('/empresas') })
  assert.equal(router.state.location.pathname, '/mesiva/empresas/nova')
  assert.match(nodeText(renderer.root), /Não foi possível confirmar/)
  await act(async () => buttonNamed(renderer.root, 'Verificar cadastro').props.onClick())
  assert.deepEqual(attempts[1], attempts[0])
  assert.equal(router.state.location.pathname, '/mesiva/empresas/new-A')
  assert.match(nodeText(renderer.root), /Company A/)
  assert.equal(calls.includes('/api/bootstrap'), false)
})
