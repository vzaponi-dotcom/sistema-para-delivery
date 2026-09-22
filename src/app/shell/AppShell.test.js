import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFile } from 'node:fs/promises'
import { act } from 'react-test-renderer'
import { workspaceHarness, nodeText } from '../../test-support/renderWorkspace.js'

test('AppShell preserva direção e foco ao trocar de página', async (t) => {
  const h = await workspaceHarness(t)
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { default: AppShell } = await h.load('/src/app/shell/AppShell.jsx')
  const { default: AppTopBar } = await h.load('/src/app/shell/AppTopBar.jsx')
  const { default: Sidebar } = await h.load('/src/app/shell/Sidebar.jsx')
  const { default: MobileNavigation } = await h.load('/src/app/shell/MobileNavigation.jsx')
  h.localStorage.setItem('delivery-notifications:v1:amor-e-sabor', JSON.stringify({ version: 1, knownIds: ['release-2026-09-operation-shell'], readIds: ['release-2026-09-operation-shell'], presentedIds: ['release-2026-09-operation-shell'] }))
  const granted = new Set(['orders.view', 'orders.history'])
  const implemented = new Set(['orders', 'history'])
  const navigationBadges = { orders: 3, comandas: 2 }
  const Wrapper = ({ activeTab }) => React.createElement(NavigationProvider, {
    activeTab, granted, implemented, moreOpen: false,
    requestNavigation() {}, openMore() {}, closeMore() {},
    children: React.createElement(AppShell, {
      businessId: 'amor-e-sabor', navigationBadges,
      children: React.createElement('span', null, activeTab),
    }),
  })
  const renderer = await h.render(Wrapper, { activeTab: 'orders' }, {
    createNodeMock: (element) => element.props?.className === 'app-content page-transition'
      ? { focus: h.recordFocus }
      : {},
  })
  const beforeFocus = h.activitySnapshot().focus
  const shell = renderer.root.findByProps({ className: 'app-shell' })
  assert.equal(shell.children[0].type, AppTopBar)
  assert.equal(shell.children[1].type, Sidebar)
  assert.doesNotMatch(nodeText(renderer.root.findByType(Sidebar)), /Amor & Sabor|Gestão do delivery/)
  assert.equal(renderer.root.findByType(Sidebar).props.badges, navigationBadges)
  assert.equal(renderer.root.findByType(MobileNavigation).props.badges, navigationBadges)
  await act(async () => renderer.update(React.createElement(Wrapper, { activeTab: 'history' })))
  const content = renderer.root.findByProps({ className: 'app-content page-transition' })
  assert.equal(content.props['data-direction'], 'forward')
  assert.equal(h.activitySnapshot().focus, beforeFocus + 1)
  await act(async () => renderer.update(React.createElement(Wrapper, { activeTab: 'orders' })))
  assert.equal(renderer.root.findByProps({ className: 'app-content page-transition' }).props['data-direction'], 'backward')
})

test('desktop shell reserves a full-width top row before the sidebar and content columns', async () => {
  const appCss = await readFile(new URL('../../App.css', import.meta.url), 'utf8')
  const topbarCss = await readFile(new URL('../../app-top-bar.css', import.meta.url), 'utf8')
  const desktopAppCss = appCss.slice(0, appCss.indexOf('@media (max-width: 1080px)'))
  const desktopTopbarCss = topbarCss.slice(0, topbarCss.indexOf('@media (max-width: 820px)'))

  assert.match(desktopAppCss, /\.app-shell\s*\{[^}]*grid-template-columns:\s*248px minmax\(0, 1fr\)[^}]*grid-template-rows:\s*56px minmax\(0, 1fr\)/s)
  assert.match(desktopAppCss, /\.sidebar\s*\{[^}]*grid-column:\s*1[^}]*grid-row:\s*2[^}]*top:\s*56px[^}]*height:\s*calc\(100vh - 56px\)/s)
  assert.match(desktopAppCss, /\.app-main\s*\{[^}]*grid-column:\s*2[^}]*grid-row:\s*2/s)
  assert.match(desktopTopbarCss, /\.app-topbar\s*\{[^}]*grid-column:\s*1 \/ -1[^}]*grid-row:\s*1/s)
})
