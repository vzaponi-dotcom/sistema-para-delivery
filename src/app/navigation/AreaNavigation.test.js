import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { workspaceHarness, buttonNamed } from '../../test-support/renderWorkspace.js'

test('AreaNavigation usa contexto e marca destino ativo', async (t) => {
  const h = await workspaceHarness(t)
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { default: AreaNavigation } = await h.load('/src/app/navigation/AreaNavigation.jsx')
  const calls = []
  const renderer = await h.render(NavigationProvider, {
    activeTab: 'history',
    granted: new Set(['orders.view', 'orders.history']),
    implemented: new Set(['orders', 'history', 'new-order']),
    moreOpen: false,
    requestNavigation: (id) => calls.push(id), openMore() {}, closeMore() {},
    children: React.createElement(AreaNavigation, { area: 'orders' }),
  })
  const nav = renderer.root.findByProps({ 'aria-label': 'Navegação de Pedidos' })
  assert.equal(buttonNamed(nav, 'Histórico').props['aria-current'], 'page')
  buttonNamed(nav, 'Cozinha').props.onClick()
  assert.deepEqual(calls, ['orders'])
})
