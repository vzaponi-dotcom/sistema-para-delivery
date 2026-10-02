import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness, buttonNamed, nodeText } from '../../test-support/renderWorkspace.js'

const implemented = new Set(['orders', 'settings-home', 'settings-business-profile', 'settings-device', 'my-account'])
const renderMenu = async (t, { granted = new Set(['operations.settings.view', 'preferences.local']), authenticated = false, user, onSwitchCompany, onSwitchUser, onLogout = () => {}, logoutDisabled = false, businessName = 'Pizzaria Bella', businessHasLogo = false, businessLogoVersion = null, mobile = false } = {}) => {
  const h = await workspaceHarness(t, { mobile })
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { default: OperationMenu } = await h.load('/src/app/shell/OperationMenu.jsx')
  const navigations = []
  const renderer = await h.render(NavigationProvider, {
    activeTab: 'orders', granted, authenticated, implemented, moreOpen: false,
    requestNavigation: (id) => navigations.push(id), openMore() {}, closeMore() {},
    children: React.createElement(OperationMenu, { businessName, businessHasLogo, businessLogoVersion, user, onSwitchCompany, onSwitchUser, onLogout, logoutDisabled }),
  }, { createNodeMock: (element) => element.props?.className === 'operation-menu-trigger'
    ? { focus: h.recordFocus }
    : element.props?.role === 'dialog' ? { querySelectorAll: () => [], querySelector: () => null } : {} })
  return { h, renderer, navigations }
}

test('operation shortcuts respect official navigation and close after navigation', async (t) => {
  const { renderer, navigations } = await renderMenu(t)
  assert.ok(buttonNamed(renderer.root, 'Pizzaria Bella, operação atual'))
  await act(async () => buttonNamed(renderer.root, 'Pizzaria Bella, operação atual').props.onClick())
  assert.ok(buttonNamed(renderer.root, 'Configurações'))
  assert.ok(buttonNamed(renderer.root, 'Este dispositivo'))
  await act(async () => buttonNamed(renderer.root, 'Este dispositivo').props.onClick())
  assert.deepEqual(navigations, ['settings-device'])
  assert.equal(buttonNamed(renderer.root, 'Configurações'), undefined)
})

test('individual user menu exposes account and switch independently of role name', async (t) => {
  let switches = 0
  const { renderer, navigations } = await renderMenu(t, { granted: new Set(), authenticated: true, user: { id: 'u', displayName: 'Ana', roleName: 'unknown-profile' }, onSwitchUser: () => switches++ })
  await act(async () => buttonNamed(renderer.root, 'Pizzaria Bella, operação atual').props.onClick())
  assert.match(nodeText(renderer.root), /Ana/)
  await act(async () => buttonNamed(renderer.root, 'Minha conta').props.onClick())
  assert.deepEqual(navigations, ['my-account'])
  await act(async () => buttonNamed(renderer.root, 'Pizzaria Bella, operação atual').props.onClick())
  await act(async () => buttonNamed(renderer.root, 'Trocar usuário').props.onClick())
  assert.equal(switches, 1)
})

test('restricted operation has no settings shortcuts', async (t) => {
  const { renderer } = await renderMenu(t, { granted: new Set(['orders.view']) })
  await act(async () => buttonNamed(renderer.root, 'Pizzaria Bella, operação atual').props.onClick())
  assert.equal(buttonNamed(renderer.root, 'Configurações'), undefined)
  assert.equal(buttonNamed(renderer.root, 'Este dispositivo'), undefined)
  assert.ok(buttonNamed(renderer.root, 'Sobre a Mesiva'))
})

test('Escape and outside click close the menu and restore focus', async (t) => {
  const { h, renderer } = await renderMenu(t)
  await act(async () => buttonNamed(renderer.root, 'Pizzaria Bella, operação atual').props.onClick())
  const before = h.activitySnapshot().focus
  await act(async () => h.document.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' })))
  assert.equal(buttonNamed(renderer.root, 'Configurações'), undefined)
  assert.ok(h.activitySnapshot().focus > before)
  await act(async () => buttonNamed(renderer.root, 'Pizzaria Bella, operação atual').props.onClick())
  await act(async () => h.document.dispatchEvent(new Event('mousedown')))
  assert.equal(buttonNamed(renderer.root, 'Configurações'), undefined)
})

test('About identifies the operation and release without a personal profile', async (t) => {
  const { renderer } = await renderMenu(t)
  await act(async () => buttonNamed(renderer.root, 'Pizzaria Bella, operação atual').props.onClick())
  await act(async () => buttonNamed(renderer.root, 'Sobre a Mesiva').props.onClick())
  assert.ok(renderer.root.findByProps({ 'aria-label': 'Sobre a Mesiva' }))
  const copy = nodeText(renderer.root)
  assert.match(copy, /Operação atual: Pizzaria Bella/)
  assert.match(copy, /Atualização atual: A Receber por cliente/)
  assert.doesNotMatch(copy, /Meu perfil|Administrador|João da Silva/)
})

test('logout invokes callback and honors disabled state', async (t) => {
  let count = 0
  const { renderer } = await renderMenu(t, { onLogout: () => count++ })
  await act(async () => buttonNamed(renderer.root, 'Pizzaria Bella, operação atual').props.onClick())
  await act(async () => buttonNamed(renderer.root, 'Sair do sistema').props.onClick())
  assert.equal(count, 1)
  assert.equal(buttonNamed(renderer.root, 'Sair do sistema'), undefined)
})

test('logout is disabled while writes are blocked', async (t) => {
  const { renderer } = await renderMenu(t, { logoutDisabled: true })
  await act(async () => buttonNamed(renderer.root, 'Pizzaria Bella, operação atual').props.onClick())
  assert.equal(buttonNamed(renderer.root, 'Sair do sistema').props.disabled, true)
})

test('operation initials ignore Portuguese connectors', async (t) => {
  const { renderer } = await renderMenu(t, { businessName: 'Sabor da Vila' })
  assert.equal(renderer.root.findByProps({ className: 'operation-menu-initials' }).children.join(''), 'SV')
  assert.ok(buttonNamed(renderer.root, 'Sabor da Vila, operação atual'))
})

test('operation identity falls back without using the business slug', async (t) => {
  const { renderer } = await renderMenu(t, { businessName: '' })
  assert.equal(renderer.root.findByProps({ className: 'operation-menu-initials' }).children.join(''), 'OP')
  assert.ok(buttonNamed(renderer.root, 'Operação, operação atual'))
  assert.doesNotMatch(nodeText(renderer.root), /amor-e-sabor/i)
})


test('operation menu uses confirmed logo when available and preserves operation name in the popover heading', async (t) => {
  const { renderer } = await renderMenu(t, {
    businessName: 'Sabor da Vila',
    businessHasLogo: true,
    businessLogoVersion: 'logo-v9',
  })
  const logo = renderer.root.findAllByType('img').find((node) => node.props.className === 'operation-menu-logo')
  assert.ok(logo)
  assert.equal(logo.props.src, '/api/business/logo?v=logo-v9')
  assert.equal(renderer.root.findAllByProps({ className: 'operation-menu-initials' }).length, 0)

  await act(async () => buttonNamed(renderer.root, 'Sabor da Vila, operação atual').props.onClick())
  assert.match(nodeText(renderer.root.findByProps({ className: 'operation-menu-heading-copy' })), /Sabor da Vila/)
})


test('operation heading links directly to Identity settings when business profile is viewable', async (t) => {
  const { renderer, navigations } = await renderMenu(t, {
    granted: new Set(['business.profile.view', 'operations.settings.view', 'preferences.local']),
  })

  await act(async () => buttonNamed(renderer.root, 'Pizzaria Bella, operação atual').props.onClick())
  const identityShortcut = buttonNamed(renderer.root, 'Editar identidade')
  assert.ok(identityShortcut)
  await act(async () => identityShortcut.props.onClick())

  assert.deepEqual(navigations, ['settings-business-profile'])
  assert.equal(buttonNamed(renderer.root, 'Configurações'), undefined)
})

test('operation heading stays non-interactive without business profile view capability', async (t) => {
  const { renderer } = await renderMenu(t, {
    granted: new Set(['operations.settings.view', 'preferences.local']),
  })

  await act(async () => buttonNamed(renderer.root, 'Pizzaria Bella, operação atual').props.onClick())
  assert.equal(buttonNamed(renderer.root, 'Editar identidade'), undefined)
  assert.match(nodeText(renderer.root.findByProps({ className: 'operation-menu-heading-copy' })), /Pizzaria Bella/)
})

test('mobile account panel keeps operator device navigation without granting identity editing', async (t) => {
  const { h, renderer, navigations } = await renderMenu(t, {
    mobile: true, authenticated: true, user: { displayName: 'Ana', roleId: 'operator' },
    granted: new Set(['preferences.local']),
  })
  await act(async () => buttonNamed(renderer.root, 'Pizzaria Bella, operação atual').props.onClick())
  assert.equal(renderer.root.findByProps({ role: 'dialog' }).props['aria-label'], 'Conta e operação')
  assert.equal(h.document.body.style.overflow, 'hidden')
  assert.equal(buttonNamed(renderer.root, 'Editar identidade'), undefined)
  assert.ok(buttonNamed(renderer.root, 'Configurações'))
  await act(async () => buttonNamed(renderer.root, 'Este dispositivo').props.onClick())
  assert.deepEqual(navigations, ['settings-device'])
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0)
  assert.notEqual(h.document.body.style.overflow, 'hidden')
})

test('resizing an open mobile panel leaves one desktop dialog and releases background scrolling', async (t) => {
  const { h, renderer } = await renderMenu(t, { mobile: true })
  await act(async () => buttonNamed(renderer.root, 'Pizzaria Bella, operação atual').props.onClick())
  assert.equal(renderer.root.findByProps({ role: 'dialog' }).props['aria-modal'], 'true')
  await act(async () => h.setMobile(false))
  const dialogs = renderer.root.findAllByProps({ role: 'dialog' })
  assert.equal(dialogs.length, 1)
  assert.notEqual(dialogs[0].props['aria-modal'], 'true')
  assert.notEqual(h.document.body.style.overflow, 'hidden')
  await act(async () => h.document.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' })))
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0)
})

test('About replaces the mobile account panel and closing restores the operation trigger', async (t) => {
  const { h, renderer } = await renderMenu(t, { mobile: true })
  await act(async () => buttonNamed(renderer.root, 'Pizzaria Bella, operação atual').props.onClick())
  assert.ok(renderer.root.findByProps({ 'aria-label': 'Conta e operação' }))
  await act(async () => buttonNamed(renderer.root, 'Sobre a Mesiva').props.onClick())
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 1)
  assert.equal(renderer.root.findByProps({ role: 'dialog' }).props['aria-label'], 'Sobre a Mesiva')
  const before = h.activitySnapshot().focus
  await act(async () => buttonNamed(renderer.root, 'Fechar').props.onClick())
  assert.ok(h.activitySnapshot().focus > before)
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0)
})

test('unknown personal profile uses its supplied name without claiming manager access', async (t) => {
  const { renderer } = await renderMenu(t, { authenticated: true, granted: new Set(), user: { displayName: 'Ana', roleName: 'Equipe externa' } })
  await act(async () => buttonNamed(renderer.root, 'Pizzaria Bella, operação atual').props.onClick())
  assert.match(nodeText(renderer.root), /Equipe externa/)
  assert.doesNotMatch(nodeText(renderer.root), /Gerente/)
  assert.equal(buttonNamed(renderer.root, 'Editar identidade'), undefined)
})

test('company switch closes account menu and respects pending-operation guard', async t => {
  let selected = 0
  const { renderer } = await renderMenu(t, { onSwitchCompany: () => { selected++ } })
  await act(async () => buttonNamed(renderer.root, 'Pizzaria Bella, operação atual').props.onClick())
  await act(async () => buttonNamed(renderer.root, 'Trocar empresa').props.onClick())
  assert.equal(selected, 1)
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0)
})
