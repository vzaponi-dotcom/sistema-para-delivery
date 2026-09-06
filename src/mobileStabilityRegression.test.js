import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile shell prevents horizontal viewport drift without blocking horizontal controls', async () => {
  const foundationCss = await read('./mobile-foundation.css')
  const mobileCss = await read('./mobile-navigation.css')

  assert.doesNotMatch(foundationCss, /\.app-main\s*\{[^}]*touch-action:\s*pan-y\s+pinch-zoom/s)
  assert.match(foundationCss, /\.app-main\s*\{[^}]*overscroll-behavior-x:\s*none/s)
  assert.match(mobileCss, /\.mobile-bottom-nav\s*\{[^}]*position:\s*fixed[^}]*bottom:\s*0/s)
  assert.match(mobileCss, /\.mobile-bottom-nav\s*\{[^}]*width:\s*100%/s)
  assert.match(foundationCss, /@media\s*\(max-width:\s*820px\)[\s\S]*overflow-x:\s*clip/)
})

test('dashboard FAB is viewport anchored and consumes shared mobile clearance tokens', async () => {
  const dashboard = await read('./pages/Dashboard.jsx')
  const dashboardCss = await read('./dashboard.css')
  const foundationCss = await read('./mobile-foundation.css')
  const mobileCss = await read('./mobile-navigation.css')

  assert.match(dashboard, /createPortal/)
  assert.match(dashboard, /document\.body/)
  assert.match(foundationCss, /--mobile-bottom-nav-height:\s*65px/)
  assert.match(foundationCss, /--mobile-floating-gap:\s*16px/)
  assert.match(
    dashboardCss,
    /@media\s*\(max-width:\s*820px\)[\s\S]*\.dashboard-new-order-fab\s*\{[^}]*bottom:\s*calc\(var\(--mobile-bottom-nav-height\)\s*\+\s*var\(--mobile-floating-gap\)\s*\+\s*var\(--mobile-safe-bottom\)\)/s,
  )
  assert.doesNotMatch(mobileCss, /\.dashboard-new-order-fab\s*\{[^}]*bottom:/s)
})

test('mobile page transition is smoother than the previous 200ms animation', async () => {
  const css = await read('./mobile-navigation.css')

  assert.match(css, /animation:\s*mobile-page-forward\s+(?:2[8-9]\d|3\d\d)ms\s+cubic-bezier/)
  assert.match(css, /animation:\s*mobile-page-backward\s+(?:2[8-9]\d|3\d\d)ms\s+cubic-bezier/)
})

test('modal and bottom sheet render at document body so scrolling and page transforms cannot move them', async () => {
  const modal = await read('./components/Modal.jsx')
  const sheet = await read('./components/BottomSheet.jsx')

  for (const source of [modal, sheet]) {
    assert.match(source, /createPortal/)
    assert.match(source, /document\.body/)
  }
})

test('mobile payment modal stays centered and selectable options scroll inside their own viewport layer', async () => {
  const foundationCss = await read('./mobile-foundation.css')
  const sheetCss = await read('./bottom-sheet.css')

  assert.match(foundationCss, /@media\s*\(max-width:\s*640px\)[\s\S]*\.modal-backdrop\s*\{[^}]*place-items:\s*center/s)
  assert.match(foundationCss, /\.modal-card\s*\{[^}]*max-height:\s*var\(--mobile-overlay-max-height\)/s)
  assert.match(sheetCss, /\.bottom-sheet\s*\{[^}]*max-height:\s*(?:var\(--mobile-overlay-max-height\)|var\(--mobile-overlay-max-height,)/s)
  assert.match(sheetCss, /\.bottom-sheet-body\s*\{[^}]*overflow-y:\s*auto/s)
  assert.match(sheetCss, /\.bottom-sheet-body\s*\{[^}]*overscroll-behavior:\s*contain/s)
})
