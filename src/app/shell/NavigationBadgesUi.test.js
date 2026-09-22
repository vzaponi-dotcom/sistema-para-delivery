import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { workspaceHarness } from '../../test-support/renderWorkspace.js'

const implemented = new Set(['orders', 'history', 'comandas'])
const fullAccess = new Set(['orders.view', 'orders.history', 'comandas.view'])

for (const name of ['Sidebar', 'MobileNavigation']) {
  test(`${name} shows authorized operational badges`, async (t) => {
    const h = await workspaceHarness(t)
    const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
    const { default: Navigation } = await h.load(`/src/app/shell/${name}.jsx`)
    const tree = React.createElement(NavigationProvider, {
      activeTab: 'orders', granted: fullAccess, implemented, moreOpen: false,
      requestNavigation() {}, openMore() {}, closeMore() {},
      children: React.createElement(Navigation, { badges: { orders: 3, comandas: 2 } }),
    })
    const renderer = await h.render(() => tree)
    assert.deepEqual(renderer.root.findAllByProps({ className: 'navigation-badge' }).map((node) => node.children.join('')), ['3', '2'])
    assert.ok(renderer.root.findByProps({ 'aria-label': 'Pedidos, 3 pedidos em andamento' }))
    assert.ok(renderer.root.findByProps({ 'aria-label': 'Comandas, 2 comandas abertas' }))
  })

  test(`${name} does not expose the Orders count through history fallback`, async (t) => {
    const h = await workspaceHarness(t)
    const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
    const { default: Navigation } = await h.load(`/src/app/shell/${name}.jsx`)
    const tree = React.createElement(NavigationProvider, {
      activeTab: 'history', granted: new Set(['orders.history']), implemented, moreOpen: false,
      requestNavigation() {}, openMore() {}, closeMore() {},
      children: React.createElement(Navigation, { badges: { orders: 3, comandas: 2 } }),
    })
    const renderer = await h.render(() => tree)
    assert.equal(renderer.root.findAllByProps({ className: 'navigation-badge' }).length, 0)
    assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Pedidos, 3 pedidos em andamento' }).length, 0)
  })
}
