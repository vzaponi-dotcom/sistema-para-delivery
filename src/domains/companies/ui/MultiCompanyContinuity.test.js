import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText, buttonNamed } from '../../../test-support/renderWorkspace.js'
import { act } from 'react-test-renderer'
import { createTenancyFixture } from '../../../../worker/test-support/tenancyDb.js'
import { createBusiness } from '../../../../worker/platform/businessProvisioning.js'

test('external session discovery preserves the author receipt before and after an uncertain response without exposing it to another account', async t => {
  for (const phase of ['before', 'after']) await t.test(phase, async t => {
    const f = await createTenancyFixture(t), h = await workspaceHarness(t), attempts = [], tasks = []
    const baseCount = f.sqlite.prepare('SELECT count(*) n FROM businesses').get().n
    const session = { authenticated: true, authMode: 'multi_company', scope: 'platform', contextId: f.contexts.admin.contextId, account: { id: f.accounts.admin, displayName: 'Admin', email: 'admin@example.test' }, capabilities: [], platformCapabilities: ['platform.businesses.view', 'platform.businesses.create'] }
    let current = session, releaseResponse, releaseDiscovery, discoveryGate = null, operation
    const responseGate = new Promise(resolve => { releaseResponse = resolve })
    const env = { DB: f.db, AUTH_MULTI_COMPANY_ENABLED: 'true', AUTH_EMAIL_FROM: 'Mesiva <access@example.test>', AUTH_PUBLIC_ORIGIN: 'https://staging.example.test', RESEND_API_KEY: 'synthetic-test-key' }
    globalThis.fetch = async (path, options = {}) => {
      if (path === '/api/auth/session') { if (discoveryGate) await discoveryGate; return { ok: true, json: async () => current } }
      if (path === '/api/platform/businesses' && options.method === 'POST') {
        const input = JSON.parse(options.body), key = new Headers(options.headers).get('Idempotency-Key'); attempts.push([key, input])
        const result = await createBusiness(env, f.contexts.admin, input, { now: f.now, idempotencyKey: key, waitUntil: task => tasks.push(task), deliver: async () => ({ status: 'uncertain' }) })
        if (attempts.length === 1) { await responseGate; throw new Error('lost committed response') }
        return { ok: true, json: async () => result }
      }
      if (path.startsWith('/api/platform/businesses/')) return { ok: true, json: async () => ({ id: path.split('/').at(-1), name: 'Private A', accessStatus: 'pending', history: [] }) }
      assert.fail(`Unexpected request: ${path}`)
    }
    const { default: App } = await h.load('/src/App.jsx'), { renderer } = await h.renderAdminApp(App, {}, { initialEntries: ['/mesiva/empresas/nova'] })
    for (const [name, value] of Object.entries({ name: 'Private A', managerName: 'Ana', managerEmail: 'ana@example.test' })) await act(async () => renderer.root.findAllByType('input').find(node => node.props.name === name).props.onChange({ target: { value } }))
    await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
    await act(async () => { operation = buttonNamed(renderer.root, 'Criar empresa e enviar convite').props.onClick() })
    if (phase === 'after') await act(async () => { releaseResponse(); await operation })
    discoveryGate = new Promise(resolve => { releaseDiscovery = resolve })
    const invalidate = id => { const event = new Event('storage'); Object.assign(event, { key: 'delivery-session-change', newValue: JSON.stringify({ type: 'session-change', id }) }); h.window.dispatchEvent(event) }
    await act(async () => invalidate('external-1'))
    assert.match(nodeText(renderer.root), /Verificando sua sessão/)
    if (phase === 'before') await act(async () => { releaseResponse(); await operation })
    await act(async () => { releaseDiscovery(); discoveryGate = null })
    assert.match(nodeText(renderer.root), /Private A/)
    assert.ok(buttonNamed(renderer.root, 'Verificar cadastro'))
    assert.equal(buttonNamed(renderer.root, 'Sair').props.disabled, true)
    current = { ...session, contextId: 'other-context', account: { id: 'other-account', displayName: 'Other', email: 'other@example.test' } }
    await act(async () => invalidate('external-2'))
    assert.doesNotMatch(nodeText(renderer.root), /Private A|ana@example.test/)
    assert.equal(buttonNamed(renderer.root, 'Sair').props.disabled, false)
    current = { ...session, contextId: 'fresh-author-context' }
    await act(async () => invalidate('external-3'))
    assert.ok(buttonNamed(renderer.root, 'Verificar cadastro'), `${phase}: ${nodeText(renderer.root)}`)
    await act(async () => buttonNamed(renderer.root, 'Verificar cadastro').props.onClick())
    await Promise.all(tasks)
    assert.deepEqual(attempts[1], attempts[0])
    assert.equal(f.sqlite.prepare('SELECT count(*) n FROM businesses').get().n, baseCount + 1)
    assert.equal(buttonNamed(renderer.root, 'Sair').props.disabled, false)
  })
})

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
