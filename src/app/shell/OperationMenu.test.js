import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness, buttonNamed, nodeText } from '../../test-support/renderWorkspace.js'

const implemented = new Set(['orders', 'settings-home', 'settings-device'])
const renderMenu = async (t, { granted = new Set(['operations.settings.view', 'preferences.local']), onLogout = () => {}, logoutDisabled = false, businessName = 'Pizzaria Bella', businessHasLogo = false, businessLogoVersion = null } = {}) => {
  const h = await workspaceHarness(t)
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { default: OperationMenu } = await h.load('/src/app/shell/OperationMenu.jsx')
  const navigations = []
  const renderer = await h.render(NavigationProvider, {
    activeTab: 'orders', granted, implemented, moreOpen: false,
    requestNavigation: (id) => navigations.push(id), openMore() {}, closeMore() {},
    children: React.createElement(OperationMenu, { businessName, businessHasLogo, businessLogoVersion, onLogout, logoutDisabled }),
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
  assert.ok(buttonNamed(renderer.root, 'Preferências deste dispositivo'))
  await act(async () => buttonNamed(renderer.root, 'Preferências deste dispositivo').props.onClick())
  assert.deepEqual(navigations, ['settings-device'])
  assert.equal(buttonNamed(renderer.root, 'Configurações'), undefined)
})

test('restricted operation has no settings shortcuts', async (t) => {
  const { renderer } = await renderMenu(t, { granted: new Set(['orders.view']) })
  await act(async () => buttonNamed(renderer.root, 'Pizzaria Bella, operação atual').props.onClick())
  assert.equal(buttonNamed(renderer.root, 'Configurações'), undefined)
  assert.equal(buttonNamed(renderer.root, 'Preferências deste dispositivo'), undefined)
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
  assert.match(copy, /Atualização atual: Nova TV da Cozinha/)
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
  assert.match(nodeText(renderer.root.findByProps({ className: 'operation-menu-heading' })), /Sabor da Vila/)
})
