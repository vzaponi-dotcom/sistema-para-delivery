import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('finance rows keep long movement copy readable at 320px', async () => {
  const appCss = await read('../App.css')
  const financeCss = await read('../finance-mobile.css')

  assert.match(appCss, /@media\s*\(max-width:\s*640px\)[\s\S]*\.movement-row\s*\{[^}]*grid-template-columns:\s*38px\s+minmax\(0,\s*1fr\)/s)
  assert.match(financeCss, /@media\s*\(max-width:\s*640px\)[\s\S]*\.movement-title-line strong\s*\{[^}]*min-width:\s*0[^}]*overflow-wrap:\s*anywhere/s)
  assert.match(financeCss, /@media\s*\(max-width:\s*640px\)[\s\S]*\.movement-main > span\s*\{[^}]*overflow-wrap:\s*anywhere/s)
  assert.match(financeCss, /@media\s*\(max-width:\s*640px\)[\s\S]*\.movement-value\s*\{[^}]*grid-column:\s*2[^}]*white-space:\s*nowrap/s)
})

test('movement modal keeps SystemSelect and a decimal-capable number input', async () => {
  const movementDialog = await read('../components/MovementDialog.jsx')

  assert.match(movementDialog, /label="Tipo do movimento"/)
  assert.match(movementDialog, /label="Categoria"/)
  assert.match(movementDialog, /<input[\s\S]*?inputMode="decimal"[\s\S]*?formatBRLCurrencyInput/)
})

test('finance exposes pending refunds with a register action only when supplied', async () => {
  const finance = await read('./Finance.jsx')

  assert.match(finance, /pendingRefundOrders/)
  assert.match(finance, /Estornos pendentes/)
  assert.match(finance, /Registrar estorno/)
  assert.match(finance, /cancelledAt/)
  assert.match(finance, /paidAmount/)
})

test('App derives pending refunds and applies the authoritative deferred refund effects', async () => {
  const app = await read('../App.jsx')

  assert.match(app, /getOrderRefundState/)
  assert.match(app, /pendingRefundOrders/)
  assert.match(app, /refundOrderApi/)
  assert.match(app, /const \{ order, movement \} = await refundOrderApi/)
  assert.match(app, /applyOfficialEffects\(\{ order, movement \}\)/)
  assert.doesNotMatch(app, /refundStatus/)
})

test('more menu keeps only approved direct destinations and touch-friendly actions', async () => {
  const nav = await read('../components/MobileNavigation.jsx')
  const navCss = await read('../mobile-navigation.css')

  assert.match(nav, /<BottomSheet[^>]*title="Mais opções"/)
  const moreEntries = nav.match(/const moreEntries = \[(.*?)\]\n/s)?.[1] || ''
  for (const id of ['print-queue', 'clients', 'products', 'tables']) assert.match(moreEntries, new RegExp(`id: '${id}'`))
  assert.match(moreEntries, /area: 'settings'/)
  assert.doesNotMatch(moreEntries, /history|dashboard|receivables|finance/)
  assert.match(nav, />Sair</)
  assert.doesNotMatch(nav, /theme-cycle-button|mobile-more-theme/)
  assert.match(navCss, /\.mobile-more-action,\s*\.mobile-more-logout\s*\{[\s\S]*?min-height:\s*48px/s)
})

test('more menu remains safe at 320px without horizontal label clipping', async () => {
  const navCss = await read('../mobile-navigation.css')
  const sheetCss = await read('../bottom-sheet.css')

  assert.match(navCss, /\.mobile-more-action,\s*\.mobile-more-logout\s*\{[^}]*width:\s*100%/s)
  assert.match(navCss, /\.mobile-nav-item span\s*\{[^}]*text-overflow:\s*ellipsis/s)
  assert.match(sheetCss, /env\(safe-area-inset-bottom/)
})
