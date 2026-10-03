import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { workspaceHarness, buttonNamed, nodeText } from '../../test-support/renderWorkspace.js'

test('desktop top bar owns the business identity and operation utilities', async (t) => {
  const h = await workspaceHarness(t)
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { default: AppTopBar } = await h.load('/src/app/shell/AppTopBar.jsx')
  const renderer = await h.render(NavigationProvider, {
    activeTab: 'orders', granted: new Set(['orders.view']), implemented: new Set(['orders']), moreOpen: false,
    requestNavigation() {}, openMore() {}, closeMore() {},
    children: React.createElement(AppTopBar, { businessId: 'pizzaria-bella', businessName: 'Pizzaria Bella' }),
  })
  assert.ok(renderer.root.findByProps({ className: 'app-topbar' }))
  assert.match(nodeText(renderer.root), /Pizzaria Bella/)
  assert.doesNotMatch(nodeText(renderer.root), /Amor & Sabor/)
  assert.match(nodeText(renderer.root), /Empresa atual/)
  assert.ok(renderer.root.findByProps({ 'aria-label': 'Localização: Pedidos' }))
  assert.doesNotMatch(nodeText(renderer.root), /Seu delivery no controle/)
  assert.ok(buttonNamed(renderer.root, 'Notificações, 1 não lida'))
  assert.ok(buttonNamed(renderer.root, 'Pizzaria Bella, empresa atual'))
  assert.equal(renderer.root.findByProps({ className: 'operation-menu-initials' }).children.join(''), 'PB')
})

test('mobile top bar exposes the official Mesiva logo and keeps operation utilities', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { default: AppTopBar } = await h.load('/src/app/shell/AppTopBar.jsx')
  const renderer = await h.render(NavigationProvider, {
    activeTab: 'orders', granted: new Set(['orders.view']), implemented: new Set(['orders']), moreOpen: false,
    requestNavigation() {}, openMore() {}, closeMore() {},
    children: React.createElement(AppTopBar, { businessId: 'pizzaria-bella', businessName: 'Pizzaria Bella' }),
  })

  const productLogo = renderer.root.findByProps({ alt: 'Mesiva' })
  assert.equal(productLogo.props.src, '/brand/mesiva-logo.svg')
  assert.doesNotMatch(nodeText(renderer.root), /Gestão do delivery/)
  assert.ok(renderer.root.findByProps({ className: 'app-topbar-actions' }))
  assert.ok(buttonNamed(renderer.root, 'Notificações, 1 não lida'))
  assert.ok(buttonNamed(renderer.root, 'Pizzaria Bella, empresa atual'))
  assert.equal(renderer.root.findByProps({ className: 'operation-menu-initials' }).children.join(''), 'PB')
})

test('desktop operation identity uses the confirmed operation logo and keeps the business name as primary text', async (t) => {
  const h = await workspaceHarness(t)
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { default: AppTopBar } = await h.load('/src/app/shell/AppTopBar.jsx')
  const renderer = await h.render(NavigationProvider, {
    activeTab: 'orders', granted: new Set(['orders.view']), implemented: new Set(['orders']), moreOpen: false,
    requestNavigation() {}, openMore() {}, closeMore() {},
    children: React.createElement(AppTopBar, {
      businessId: 'pizzaria-bella',
      businessName: 'Pizzaria Bella',
      businessHasLogo: true,
      businessLogoVersion: 'logo-v7',
    }),
  })

  const logo = renderer.root.findAllByType('img').find((node) => node.props.className === 'operation-menu-logo')
  assert.ok(logo)
  assert.equal(logo.props.src, '/api/business/logo?v=logo-v7')
  assert.equal(logo.props.alt, '')
  assert.match(nodeText(renderer.root), /Pizzaria Bella/)
  assert.match(nodeText(renderer.root), /Empresa atual/)
  assert.ok(renderer.root.findByProps({ 'aria-label': 'Localização: Pedidos' }))
})

test('mobile product brand stays Mesiva while the operation menu uses the confirmed operation logo', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { default: AppTopBar } = await h.load('/src/app/shell/AppTopBar.jsx')
  const renderer = await h.render(NavigationProvider, {
    activeTab: 'orders', granted: new Set(['orders.view']), implemented: new Set(['orders']), moreOpen: false,
    requestNavigation() {}, openMore() {}, closeMore() {},
    children: React.createElement(AppTopBar, {
      businessId: 'pizzaria-bella',
      businessName: 'Pizzaria Bella',
      businessHasLogo: true,
      businessLogoVersion: 'logo-mobile-v2',
    }),
  })

  assert.match(nodeText(renderer.root), /Mesiva/)
  assert.doesNotMatch(nodeText(renderer.root.findByProps({ className: 'app-topbar-brand' })), /Pizzaria Bella/)
  const menuLogo = renderer.root.findAllByType('img').find((node) => node.props.className === 'operation-menu-logo')
  assert.ok(menuLogo)
  assert.equal(menuLogo.props.src, '/api/business/logo?v=logo-mobile-v2')
  assert.equal(renderer.root.findAllByProps({ className: 'operation-menu-initials' }).length, 0)
})
