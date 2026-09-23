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


test('desktop sidebar keeps compact natural rows with premium token-based group separation', async () => {
  const [appCss, sidebarSource] = await Promise.all([
    readFile(new URL('../../App.css', import.meta.url), 'utf8'),
    readFile(new URL('./Sidebar.jsx', import.meta.url), 'utf8'),
  ])
  const sidebar = appCss.slice(appCss.indexOf('.sidebar {'), appCss.indexOf('.app-main {'))

  assert.match(sidebar, /\.sidebar\s*\{[^}]*background:\s*var\(--surface\)[^}]*color:\s*var\(--text\)[^}]*border-right:\s*1px solid var\(--border\)/s)
  assert.match(sidebar, /\.sidebar-nav\s*\{[^}]*align-content:\s*start/s)
  assert.match(sidebar, /\.sidebar-group\s*\{[^}]*align-content:\s*start/s)
  assert.match(sidebar, /\.sidebar-group \+ \.sidebar-group\s*\{[^}]*border-top:\s*1px solid var\(--border\)[^}]*padding-top:/s)
  assert.match(sidebar, /\.sidebar-group-label\s*\{[^}]*color:\s*var\(--muted\)/s)
  assert.match(sidebar, /\.sidebar-link\s*\{[^}]*min-height:\s*46px[^}]*color:\s*var\(--text-soft\)/s)
  assert.doesNotMatch(sidebar, /#211b1a|rgba\(255,\s*255,\s*255/)
  assert.doesNotMatch(sidebarSource, /sidebar-brand|Amor & Sabor|Gestão do delivery/)
})

test('desktop sidebar anchors badges above a fixed icon column without shifting labels', async (t) => {
  const h = await workspaceHarness(t)
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { default: Sidebar } = await h.load('/src/app/shell/Sidebar.jsx')
  const renderer = await h.render(NavigationProvider, {
    activeTab: 'orders', granted: fullAccess, implemented, moreOpen: false,
    requestNavigation() {}, openMore() {}, closeMore() {},
    children: React.createElement(Sidebar, { badges: { orders: 3 } }),
  })
  const orders = renderer.root.findByProps({ 'aria-label': 'Pedidos, 3 pedidos em andamento' })
  const iconWrap = orders.findByProps({ className: 'navigation-icon-wrap' })
  const label = orders.findByProps({ className: 'sidebar-link-label' })
  assert.equal(iconWrap.findByProps({ className: 'navigation-badge' }).children.join(''), '3')
  assert.equal(label.findAllByProps({ className: 'navigation-badge' }).length, 0)

  const badgeCss = await readFile(new URL('../../navigation-badges.css', import.meta.url), 'utf8')
  const desktopBadges = badgeCss.slice(0, badgeCss.indexOf('@media (max-width: 820px)'))
  assert.match(desktopBadges, /\.navigation-icon-wrap\s*\{[^}]*position:\s*relative/s)
  assert.match(desktopBadges, /\.sidebar-link \.navigation-icon-wrap\s*\{[^}]*width:\s*20px/s)
  assert.match(desktopBadges, /\.navigation-badge\s*\{[^}]*position:\s*absolute[^}]*top:\s*-[1-9]\d*px[^}]*border:\s*0/s)
  assert.doesNotMatch(desktopBadges, /\.sidebar-link-label \.navigation-badge/)
  assert.match(desktopBadges, /\.sidebar-link\.active \.navigation-badge\s*\{[^}]*background:\s*var\(--primary-contrast\)[^}]*color:\s*var\(--primary\)/s)
})

test('mobile badge contract stays scoped to the approved 820px layout', async () => {
  const badgeCss = await readFile(new URL('../../navigation-badges.css', import.meta.url), 'utf8')
  const mobileBadges = badgeCss.slice(badgeCss.indexOf('@media (max-width: 820px)'))
  assert.match(mobileBadges, /@media \(max-width:\s*820px\)/)
  assert.match(mobileBadges, /\.mobile-nav-item \.navigation-icon-wrap\s*\{[^}]*overflow:\s*visible/s)
  assert.match(mobileBadges, /\.mobile-nav-item \.navigation-badge\s*\{[^}]*top:\s*-7px[^}]*left:\s*calc\(100% - 4px\)[^}]*min-width:\s*17px[^}]*height:\s*17px/s)
})

test('desktop sidebar shows the active print-job count from the shared operational badges', async (t) => {
  const h = await workspaceHarness(t)
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { default: Sidebar } = await h.load('/src/app/shell/Sidebar.jsx')
  const renderer = await h.render(NavigationProvider, {
    activeTab: 'orders',
    granted: new Set(['orders.view', 'printing.queue']),
    implemented: new Set(['orders', 'print-queue']),
    moreOpen: false,
    requestNavigation() {}, openMore() {}, closeMore() {},
    children: React.createElement(Sidebar, { badges: { 'print-queue': 4 } }),
  })

  const button = renderer.root.findByProps({ 'aria-label': 'Fila de impressão, 4 jobs ativos' })
  assert.ok(button)
  assert.equal(button.findByProps({ className: 'navigation-badge' }).children.join(''), '4')
})

test('App wires the printing manager active count to sidebar and Orders queue affordances', async () => {
  const source = await readFile(new URL('../../App.jsx', import.meta.url), 'utf8')
  assert.match(source, /'print-queue':\s*printing\.activeJobCount/)
  assert.match(source, /printQueueActiveCount=\{printing\.activeJobCount\}/)
})
