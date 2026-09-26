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


test('Financeiro keeps Relatórios on desktop and removes it from mobile area navigation', async (t) => {
  const granted = new Set(['finance.overview', 'reports.view', 'finance.receivables', 'finance.movements'])
  const implemented = new Set(['dashboard', 'reports', 'receivables', 'finance'])

  for (const mobile of [false, true]) {
    const h = await workspaceHarness(t, { mobile })
    const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
    const { default: AreaNavigation } = await h.load('/src/app/navigation/AreaNavigation.jsx')
    const renderer = await h.render(NavigationProvider, {
      activeTab: mobile ? 'dashboard' : 'reports',
      granted,
      implemented,
      moreOpen: false,
      requestNavigation() {}, openMore() {}, closeMore() {},
      children: React.createElement(AreaNavigation, { area: 'finance' }),
    })
    const labels = renderer.root.findAllByType('button').map((button) => button.children.join(''))
    assert.equal(labels.includes('Visão geral'), true)
    assert.equal(labels.includes('Relatórios'), !mobile)
    assert.equal(labels.includes('A receber'), true)
    assert.equal(labels.includes('Movimentações'), true)
  }
})
