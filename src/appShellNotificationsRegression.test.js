import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')
const [shell, topbar, entry, topbarCss, centerCss, badgesCss, mobileCss] = await Promise.all([
  read('./app/shell/AppShell.jsx'), read('./app/shell/AppTopBar.jsx'), read('./app/notifications/NotificationsEntryPoint.jsx'),
  read('./app-top-bar.css'), read('./notification-center.css'), read('./navigation-badges.css'), read('./mobile-navigation.css'),
])

test('global utility shell stays responsive without duplicating navigation', () => {
  assert.match(shell, /<AppTopBar/)
  assert.doesNotMatch(topbar, /MOBILE_DIRECT_ENTRIES|DESKTOP_NAV_GROUPS/)
  assert.match(topbarCss, /@media\s*\(max-width:\s*820px\)/)
  assert.match(topbarCss, /\.app-topbar-brand/)
  assert.doesNotMatch(topbarCss, /\.app-topbar\s*\{[^}]*position:\s*fixed/s)
})

test('notification center has distinct desktop drawer and mobile sheet contracts', () => {
  assert.match(entry, /notification-center-drawer/)
  assert.match(entry, /<BottomSheet/)
  assert.match(centerCss, /\.notification-center-backdrop/)
  assert.doesNotMatch(centerCss, /#[0-9a-f]{3,8}/i)
})

test('new surfaces use the existing focus-managed Modal and BottomSheet', () => {
  assert.match(entry, /<Modal/)
  assert.match(entry, /<BottomSheet/)
  assert.doesNotMatch(entry, /document\.body\.style\.overflow/)
})

test('badges stay visible beside mobile icons without growing bottom navigation cells', () => {
  assert.match(badgesCss, /\.navigation-badge/)
  assert.match(badgesCss, /@media\s*\(max-width:\s*820px\)/)
  assert.match(mobileCss, /grid-auto-columns:\s*minmax\(0,\s*1fr\)/)
  assert.match(badgesCss, /\.mobile-nav-item \.navigation-icon-wrap\s*\{[^}]*overflow:\s*visible/s)
  assert.match(badgesCss, /\.mobile-nav-item \.navigation-badge\s*\{[^}]*max-width:\s*none/s)
})
