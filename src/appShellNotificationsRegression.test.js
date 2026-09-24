import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')
const [app, runtime, shell, topbar, entry, centerComponent, topbarCss, centerCss, badgesCss, mobileCss] = await Promise.all([
  read('./App.jsx'), read('./app/runtime/data/useOperationalDataRuntime.js'), read('./app/shell/AppShell.jsx'), read('./app/shell/AppTopBar.jsx'), read('./app/notifications/NotificationsEntryPoint.jsx'), read('./app/notifications/NotificationCenter.jsx'),
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

test('business display name flows from the official bootstrap into the global shell', () => {
  assert.match(runtime, /const \[business, setBusiness\] = useState\(null\)/)
  assert.match(runtime, /setBusiness\(data\.business\)/)
  assert.match(app, /\bbusiness,\s*\n\s*bootstrapState/)
  assert.match(app, /businessName=\{business\?\.name\}/)
  assert.match(shell, /businessName/)
  assert.doesNotMatch(topbar, /'Amor & Sabor'/)
})

test('mobile notification detail relies on the sheet close action without a large back button', () => {
  assert.doesNotMatch(centerComponent, /notification-back/)
  assert.doesNotMatch(centerComponent, />Voltar</)
  assert.doesNotMatch(centerCss, /\.notification-back/)
})


test('confirmed business profile commits refresh the official bootstrap before the shell reads identity', () => {
  assert.match(app, /onPolicyCommitted=\{\(\{ policyId \}\) => \{[\s\S]*businessProfile[\s\S]*refreshBootstrapSilently/)
  assert.match(app, /businessHasLogo=\{business\?\.hasLogo\}/)
  assert.match(app, /businessLogoVersion=\{business\?\.logoVersion\}/)
  assert.match(shell, /businessHasLogo/)
  assert.match(shell, /businessLogoVersion/)
})

test('operation shell never reads business-profile draft or transient logo state directly', () => {
  assert.doesNotMatch(topbar, /logoAction|local:/)
  assert.doesNotMatch(shell, /logoAction|local:/)
  assert.doesNotMatch(app, /resources\.businessProfile|logoBlob/)
})
