import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFile } from 'node:fs/promises'
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


test('desktop sidebar follows the active theme and positions borderless badges before the icon', async () => {
  const [appCss, badgeCss] = await Promise.all([
    readFile(new URL('../../App.css', import.meta.url), 'utf8'),
    readFile(new URL('../../navigation-badges.css', import.meta.url), 'utf8'),
  ])
  const sidebar = appCss.slice(appCss.indexOf('.sidebar {'), appCss.indexOf('.app-main {'))
  const desktopBadges = badgeCss.slice(0, badgeCss.indexOf('@media (max-width: 820px)'))

  assert.match(sidebar, /\.sidebar\s*\{[^}]*background:\s*var\(--surface\)[^}]*color:\s*var\(--text\)[^}]*border-right:\s*1px solid var\(--border\)/s)
  assert.match(sidebar, /\.sidebar-group-label\s*\{[^}]*color:\s*var\(--muted\)/s)
  assert.match(sidebar, /\.sidebar-link\s*\{[^}]*color:\s*var\(--text-soft\)/s)
  assert.doesNotMatch(sidebar, /#211b1a|rgba\(255,\s*255,\s*255/)
  assert.match(desktopBadges, /\.navigation-badge\s*\{[^}]*top:\s*-7px[^}]*left:\s*-9px[^}]*border:\s*0/s)
  assert.match(desktopBadges, /\.sidebar-link\.active \.navigation-badge\s*\{[^}]*background:\s*#fff[^}]*color:\s*var\(--primary\)/s)
})
