import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness, buttonNamed, nodeText } from '../../test-support/renderWorkspace.js'

const one = [{ businessId: 'company-a', name: 'Amor & Sabor', roleName: 'Gerente' }]
const two = [...one, { businessId: 'company-b', name: 'Outra empresa', roleName: 'Operador' }]
const response = businesses => new Response(JSON.stringify({ businesses }), { headers: { 'content-type': 'application/json' } })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

async function setup(t, { businesses = one, transport, mobile = false, platform = false, disabled = false, legacy = false } = {}) {
  const h = await workspaceHarness(t, { mobile })
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { ContextApi } = await h.load('/src/infrastructure/api/ContextApi.js')
  const { createContextHttpClient } = await h.load('/src/infrastructure/api/contextHttpClient.js')
  const { default: OperationMenu } = await h.load('/src/app/shell/OperationMenu.jsx')
  const requests = []
  let switched = 0
  const createClient = (contextId, send) => createContextHttpClient({
    context: { contextId },
    fetchImpl: async (path, options) => {
      requests.push({ path, options })
      assert.equal(path, '/api/auth/businesses')
      return send ? send(path, options) : response(businesses)
    },
  })
  let currentClient = createClient('context-a', transport)
  const element = () => React.createElement(ContextApi.Provider, { value: currentClient },
    React.createElement(NavigationProvider, {
      activeTab: 'orders', authenticated: !legacy,
      granted: new Set(['business.profile.view', 'operations.settings.view', 'preferences.local']),
      implemented: new Set(['orders', 'settings-home', 'settings-device', 'my-account']),
      requestNavigation() {}, openMore() {}, closeMore() {},
    }, React.createElement(OperationMenu, {
      businessName: 'Amor & Sabor', user: { displayName: 'Victor', roleId: 'manager' },
      onSwitchCompany: legacy ? undefined : () => { switched++ },
      onPlatform: platform ? () => {} : undefined, onSwitchUser() {}, onLogout() {}, logoutDisabled: disabled,
    })))
  const renderer = await h.render(() => element(), {}, { createNodeMock: () => ({ focus() {}, querySelectorAll: () => [] }) })
  const toggle = async () => act(async () => buttonNamed(renderer.root, 'Amor & Sabor, empresa atual').props.onClick())
  const updateContext = async (id, send) => {
    currentClient = createClient(id, send)
    await act(async () => renderer.update(element()))
  }
  return { h, renderer, toggle, requests, updateContext, switched: () => switched }
}

for (const [name, businesses] of [['one eligible company', one], ['zero eligible companies', []], ['duplicate company IDs', [...one, ...one]]]) {
  test(`company menu hides switching for ${name} without hiding company identity or settings`, async t => {
    const { renderer, toggle } = await setup(t, { businesses })
    await toggle()
    assert.equal(buttonNamed(renderer.root, 'Trocar empresa'), undefined)
    assert.match(nodeText(renderer.root.findByProps({ className: 'operation-menu-heading-copy' })), /Amor & Sabor/)
    assert.ok(buttonNamed(renderer.root, 'Configurações da empresa'))
  })
}

test('two eligible companies expose exactly one switch action using the official contextual API', async t => {
  const { renderer, toggle, requests, switched } = await setup(t, { businesses: two })
  assert.equal(requests.length, 0, 'Do not fetch companies while the menu is closed')
  await toggle()
  assert.equal(requests.length, 1)
  assert.equal(new Headers(requests[0].options.headers).get('X-Mesiva-Context'), 'context-a')
  assert.equal(renderer.root.findAllByType('button').filter(node => node.props['aria-label'] === 'Trocar empresa').length, 1)
  await act(async () => buttonNamed(renderer.root, 'Trocar empresa').props.onClick())
  assert.equal(switched(), 1)
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0)
})

test('company access is not assumed while the official list is still loading', async t => {
  const pending = deferred()
  const { renderer, toggle } = await setup(t, { transport: () => pending.promise })
  await toggle()
  assert.equal(buttonNamed(renderer.root, 'Trocar empresa'), undefined)
  assert.match(nodeText(renderer.root), /Verificando suas empresas/)
  await act(async () => pending.resolve(response(two)))
  assert.ok(buttonNamed(renderer.root, 'Trocar empresa'))
})

test('a failed company check does not expose switching and can be retried', async t => {
  let calls = 0
  const { renderer, toggle } = await setup(t, { transport: () => {
    calls++
    if (calls === 1) throw new Error('offline')
    return response(two)
  } })
  await toggle()
  assert.equal(buttonNamed(renderer.root, 'Trocar empresa'), undefined)
  assert.match(nodeText(renderer.root), /Não foi possível verificar suas empresas/)
  await act(async () => buttonNamed(renderer.root, 'Verificar empresas novamente').props.onClick())
  assert.ok(buttonNamed(renderer.root, 'Trocar empresa'))
  assert.equal(calls, 2)
})

test('closing and reopening the menu refreshes eligibility after a membership changes', async t => {
  let current = two
  const { renderer, toggle } = await setup(t, { transport: () => response(current) })
  await toggle()
  assert.ok(buttonNamed(renderer.root, 'Trocar empresa'))
  await toggle()
  current = one
  await toggle()
  assert.equal(buttonNamed(renderer.root, 'Trocar empresa'), undefined)
})

test('late company responses cannot reveal switching in another context', async t => {
  const old = deferred()
  const current = deferred()
  const { renderer, toggle, updateContext } = await setup(t, { transport: () => old.promise })
  await toggle()
  await updateContext('context-b', () => current.promise)
  if (!renderer.root.findAllByProps({ role: 'dialog' }).length) await toggle()
  await act(async () => current.resolve(response(one)))
  await act(async () => old.resolve(response(two)))
  assert.equal(buttonNamed(renderer.root, 'Trocar empresa'), undefined)
})

test('a verified company switch remains disabled while operational writes block context changes', async t => {
  const { renderer, toggle } = await setup(t, { businesses: two, disabled: true })
  await toggle()
  assert.equal(buttonNamed(renderer.root, 'Trocar empresa').props.disabled, true)
})

test('legacy sessions do not request company membership information', async t => {
  const { renderer, toggle, requests } = await setup(t, { legacy: true })
  await toggle()
  assert.equal(requests.length, 0)
  assert.equal(buttonNamed(renderer.root, 'Trocar empresa'), undefined)
})

test('restaurant manager without platform grant has no Mesiva administration section', async t => {
  const { renderer, toggle } = await setup(t)
  await toggle()
  assert.equal(buttonNamed(renderer.root, 'Administração Mesiva'), undefined)
  assert.equal(renderer.root.findAllByType('section').some(node => node.props['aria-label'] === 'Administração Mesiva'), false)
})

for (const mobile of [false, true]) {
  test(`approved grouped layout keeps account, company and platform actions in their own cards (${mobile ? 'mobile' : 'desktop'})`, async t => {
    const { renderer, toggle } = await setup(t, { businesses: two, platform: true, mobile })
    await toggle()
    const sections = renderer.root.findAllByType('section')
    assert.deepEqual(sections.map(node => node.props['aria-label']), ['Sua conta', 'Empresa atual', 'Administração Mesiva', 'Preferências e ajuda'])
    const account = sections[0].findByProps({ className: 'operation-menu-card' })
    const company = sections[1].findByProps({ className: 'operation-menu-card operation-menu-company-card' })
    const platform = sections[2].findByProps({ className: 'operation-menu-card' })
    assert.ok(buttonNamed(account, 'Minha conta'))
    assert.ok(buttonNamed(account, 'Trocar usuário'))
    assert.match(nodeText(company), /Amor & Sabor/)
    assert.ok(buttonNamed(company, 'Trocar empresa'))
    assert.ok(buttonNamed(company, 'Configurações da empresa'))
    assert.ok(buttonNamed(platform, 'Administração Mesiva'))
    assert.ok(buttonNamed(renderer.root, 'Este dispositivo'))
    assert.ok(buttonNamed(renderer.root, 'Sobre a Mesiva'))
    assert.ok(buttonNamed(renderer.root, 'Sair do sistema'))
    assert.doesNotMatch(nodeText(renderer.root), /planos|cobrança/i)
  })
}
