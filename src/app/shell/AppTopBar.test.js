import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { workspaceHarness, buttonNamed, nodeText } from '../../test-support/renderWorkspace.js'

test('global top bar composes product identity and operation utilities', async (t) => {
  const h = await workspaceHarness(t)
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { default: AppTopBar } = await h.load('/src/app/shell/AppTopBar.jsx')
  const renderer = await h.render(NavigationProvider, {
    activeTab: 'orders', granted: new Set(['orders.view']), implemented: new Set(['orders']), moreOpen: false,
    requestNavigation() {}, openMore() {}, closeMore() {},
    children: React.createElement(AppTopBar, { businessId: 'amor-e-sabor' }),
  })
  assert.ok(renderer.root.findByProps({ className: 'app-topbar' }))
  assert.match(nodeText(renderer.root), /Gestão Delivery/)
  assert.ok(buttonNamed(renderer.root, 'Notificações, 1 não lida'))
  assert.ok(buttonNamed(renderer.root, 'Amor & Sabor, operação atual'))
})
