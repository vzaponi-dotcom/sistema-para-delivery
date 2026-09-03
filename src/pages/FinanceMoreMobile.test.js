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
  const app = await read('../App.jsx')

  assert.match(app, /label="Tipo da movimentação"/)
  assert.match(app, /label="Categoria da movimentação"/)
  assert.match(app, /<input[^>]*type="number"[^>]*min="0"[^>]*step="0\.01"/)
})

test('finance exposes pending refunds with a register action only when supplied', async () => {
  const finance = await read('./Finance.jsx')

  assert.match(finance, /pendingRefundOrders/)
  assert.match(finance, /Estornos pendentes/)
  assert.match(finance, /Registrar estorno/)
  assert.match(finance, /cancelledAt/)
  assert.match(finance, /paidAmount/)
})

test('App derives pending refunds and wires deferred refund without persisting a refund status', async () => {
  const app = await read('../App.jsx')

  assert.match(app, /getOrderRefundState/)
  assert.match(app, /pendingRefundOrders/)
  assert.match(app, /refundOrderApi/)
  assert.match(app, /source === 'order-refund'/)
  assert.doesNotMatch(app, /refundStatus/)
})

test('more menu actions including theme and logout stay touch friendly', async () => {
  const nav = await read('../components/MobileNavigation.jsx')
  const navCss = await read('../mobile-navigation.css')

  assert.match(nav, /<BottomSheet[^>]*title="Mais opções"/)
  assert.match(nav, />A Receber</)
  assert.match(nav, />Financeiro</)
  assert.match(nav, /Sair do sistema/)
  assert.match(navCss, /\.mobile-more-action,\s*\.mobile-more-logout\s*\{[\s\S]*?min-height:\s*48px/s)
  assert.match(navCss, /\.mobile-more-theme \.theme-option\s*\{[^}]*min-height:\s*48px/s)
})

test('more menu remains safe at 320px without horizontal label clipping', async () => {
  const navCss = await read('../mobile-navigation.css')
  const sheetCss = await read('../bottom-sheet.css')

  assert.match(navCss, /@media\s*\(max-width:\s*390px\)[\s\S]*\.mobile-more-theme \.theme-segmented-control\s*\{[^}]*grid-template-columns:\s*1fr/s)
  assert.match(navCss, /@media\s*\(max-width:\s*390px\)[\s\S]*\.mobile-more-theme \.theme-option\s*\{[^}]*white-space:\s*normal/s)
  assert.match(sheetCss, /env\(safe-area-inset-bottom/)
})
