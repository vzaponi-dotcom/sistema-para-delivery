import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile foundation owns the 320px viewport and bottom navigation clearance', async () => {
  const indexCss = await read('./index.css')
  const foundationCss = await read('./mobile-foundation.css')

  assert.match(indexCss, /html\s*\{[^}]*min-width:\s*320px/s)
  assert.match(indexCss, /body\s*\{[^}]*min-width:\s*320px/s)
  assert.match(foundationCss, /--mobile-page-inline:\s*14px/)
  assert.match(foundationCss, /--mobile-content-bottom-space:\s*calc\(/)
  assert.match(foundationCss, /html,\s*body,\s*#root\s*\{[^}]*overflow-x:\s*clip/s)
  assert.match(foundationCss, /\.app-shell \.app-content\s*\{[^}]*padding-bottom:\s*var\(--mobile-content-bottom-space\)/s)
})

test('navigation overlays floating action and toast use one shared layer scale', async () => {
  const foundationCss = await read('./mobile-foundation.css')
  const navCss = await read('./mobile-navigation.css')
  const sheetCss = await read('./bottom-sheet.css')
  const dashboardCss = await read('./dashboard.css')

  assert.match(foundationCss, /--layer-mobile-nav:\s*60/)
  assert.match(foundationCss, /--layer-floating-action:\s*70/)
  assert.match(foundationCss, /--layer-overlay:\s*100/)
  assert.match(foundationCss, /--layer-overlay-raised:\s*110/)
  assert.match(foundationCss, /--layer-toast:\s*120/)
  assert.match(navCss, /z-index:\s*var\(--layer-mobile-nav\)/)
  assert.match(sheetCss, /z-index:\s*var\(--layer-overlay-raised\)/)
  assert.match(dashboardCss, /\.dashboard-new-order-fab\s*\{[^}]*z-index:\s*var\(--layer-floating-action\)/s)
})

test('shared overlays remain dynamic-viewport sized and safe-area aware', async () => {
  const foundationCss = await read('./mobile-foundation.css')
  const sheetCss = await read('./bottom-sheet.css')

  assert.match(foundationCss, /--mobile-safe-bottom:\s*env\(safe-area-inset-bottom,\s*0px\)/)
  assert.match(foundationCss, /--mobile-overlay-max-height:\s*min\(88dvh,\s*720px\)/)
  assert.match(foundationCss, /body > \.modal-backdrop[^}]*place-items:\s*center/s)
  assert.match(sheetCss, /max-height:\s*var\(--mobile-overlay-max-height/)
  assert.match(sheetCss, /env\(safe-area-inset-bottom/)
})

test('screen-specific narrow rules cover the audited 320 to 480px range', async () => {
  const files = await Promise.all([
    read('./new-order.css'),
    read('./order-operations-compact.css'),
    read('./receivables.css'),
    read('./clients-phonebook.css'),
    read('./product-form.css'),
    read('./dashboard.css'),
    read('./finance-mobile.css'),
    read('./mobile-navigation.css'),
  ])

  for (const css of files) {
    assert.match(css, /@media\s*\(max-width:\s*(?:390|520|640|760|820)px\)/)
  }

  assert.match(files[5], /@media\s*\(max-width:\s*390px\)/)
  assert.match(files[7], /@media\s*\(max-width:\s*390px\)/)
})
