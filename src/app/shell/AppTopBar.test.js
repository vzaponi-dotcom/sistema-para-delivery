import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFile } from 'node:fs/promises'
import { workspaceHarness, buttonNamed, nodeText } from '../../test-support/renderWorkspace.js'

test('desktop top bar owns the business identity and operation utilities', async (t) => {
  const h = await workspaceHarness(t)
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { default: AppTopBar } = await h.load('/src/app/shell/AppTopBar.jsx')
  const renderer = await h.render(NavigationProvider, {
    activeTab: 'orders', granted: new Set(['orders.view']), implemented: new Set(['orders']), moreOpen: false,
    requestNavigation() {}, openMore() {}, closeMore() {},
    children: React.createElement(AppTopBar, { businessId: 'amor-e-sabor' }),
  })
  assert.ok(renderer.root.findByProps({ className: 'app-topbar' }))
  assert.match(nodeText(renderer.root), /Amor & Sabor/)
  assert.match(nodeText(renderer.root), /Gestão do delivery/)
  assert.doesNotMatch(nodeText(renderer.root), /Seu delivery no controle/)
  assert.ok(buttonNamed(renderer.root, 'Notificações, 1 não lida'))
  assert.ok(buttonNamed(renderer.root, 'Amor & Sabor, operação atual'))
})

test('mobile top bar exposes the approved premium product brand and subtitle', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  const { default: AppTopBar } = await h.load('/src/app/shell/AppTopBar.jsx')
  const renderer = await h.render(NavigationProvider, {
    activeTab: 'orders', granted: new Set(['orders.view']), implemented: new Set(['orders']), moreOpen: false,
    requestNavigation() {}, openMore() {}, closeMore() {},
    children: React.createElement(AppTopBar, { businessId: 'amor-e-sabor' }),
  })

  assert.ok(renderer.root.findByProps({ className: 'app-topbar-brand-icon' }))
  assert.ok(renderer.root.findByProps({ className: 'app-topbar-brand-copy' }))
  assert.equal(renderer.root.findByProps({ className: 'app-topbar-brand-subtitle' }).children.join(''), 'Seu delivery no controle')
  assert.match(nodeText(renderer.root), /Gestão Delivery/)
  assert.doesNotMatch(nodeText(renderer.root), /Gestão do delivery/)
  assert.ok(renderer.root.findByProps({ className: 'app-topbar-actions' }))
  assert.ok(buttonNamed(renderer.root, 'Notificações, 1 não lida'))
  assert.ok(buttonNamed(renderer.root, 'Amor & Sabor, operação atual'))
})

test('desktop utilities reuse the premium visual language from mobile', async () => {
  const css = await readFile(new URL('../../app-top-bar.css', import.meta.url), 'utf8')
  const desktop = css.slice(0, css.indexOf('@media (max-width: 820px)'))

  assert.match(desktop, /\.app-topbar-brand\s*\{[^}]*display:\s*inline-flex/s)
  assert.match(desktop, /\.app-topbar-brand-icon\s*\{[^}]*border-radius:\s*12px[^}]*background:\s*var\(--primary-soft\)/s)
  assert.match(desktop, /\.notification-bell\s*\{[^}]*border-radius:\s*12px[^}]*background:\s*var\(--surface-soft\)/s)
  assert.match(desktop, /\.operation-menu-trigger\s*\{[^}]*border-radius:\s*999px[^}]*background:\s*var\(--surface-soft\)/s)
  assert.match(desktop, /\.operation-menu-initials\s*\{[^}]*background:\s*var\(--primary-soft\)[^}]*color:\s*var\(--primary\)/s)
})

test('mobile top bar stylesheet pins the approved rounded container and cohesive utility controls', async () => {
  const css = await readFile(new URL('../../app-top-bar.css', import.meta.url), 'utf8')
  const mobile = css.slice(css.indexOf('@media (max-width: 820px)'))

  assert.match(mobile, /\.app-topbar\s*\{[^}]*min-height:\s*56px[^}]*margin:\s*4px 8px 6px[^}]*padding:\s*5px 8px[^}]*border-radius:\s*20px/s)
  assert.doesNotMatch(mobile, /safe-area-inset-top/)
  assert.match(mobile, /\.app-topbar-brand-icon\s*\{[^}]*width:\s*40px[^}]*height:\s*40px[^}]*border-radius:\s*14px/s)
  assert.match(mobile, /\.app-topbar-brand-subtitle\s*\{/)
  assert.match(mobile, /\.notification-bell\s*\{[^}]*width:\s*44px[^}]*height:\s*44px[^}]*border-radius:\s*14px/s)
  assert.match(mobile, /\.operation-menu-trigger\s*\{[^}]*min-height:\s*44px/s)
  assert.match(mobile, /\.operation-menu-initials\s*\{[^}]*width:\s*34px[^}]*height:\s*34px/s)
})
