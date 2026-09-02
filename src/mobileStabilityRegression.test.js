import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getSwipeDirection } from './utils/mobileNavigation.js'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile shell prevents horizontal viewport drift while preserving vertical scroll', async () => {
  const mobileCss = await read('./mobile-navigation.css')
  const rootCss = await read('./index.css')

  assert.match(mobileCss, /\.app-main\s*\{[^}]*touch-action:\s*pan-y\s+pinch-zoom/s)
  assert.match(mobileCss, /\.app-main\s*\{[^}]*overscroll-behavior-x:\s*none/s)
  assert.match(mobileCss, /\.mobile-bottom-nav\s*\{[^}]*position:\s*fixed[^}]*bottom:\s*0/s)
  assert.match(mobileCss, /\.mobile-bottom-nav\s*\{[^}]*width:\s*100%/s)
  assert.match(rootCss, /@media\s*\(max-width:\s*820px\)[\s\S]*overflow-x:\s*clip/)
})

test('dashboard FAB is viewport anchored outside the animated page and clears the mobile nav', async () => {
  const dashboard = await read('./pages/Dashboard.jsx')
  const mobileCss = await read('./mobile-navigation.css')

  assert.match(dashboard, /createPortal/)
  assert.match(dashboard, /document\.body/)
  assert.match(mobileCss, /\.dashboard-new-order-fab\s*\{[^}]*bottom:\s*calc\((?:10[8-9]|11\d|1[2-9]\d)px\s*\+\s*env\(safe-area-inset-bottom\)\)/s)
})

test('quick deliberate flicks navigate while short or vertical gestures do not', () => {
  assert.equal(getSwipeDirection({ deltaX: -36, deltaY: 8, durationMs: 110 }), 'next')
  assert.equal(getSwipeDirection({ deltaX: 36, deltaY: 8, durationMs: 110 }), 'previous')
  assert.equal(getSwipeDirection({ deltaX: -24, deltaY: 4, durationMs: 90 }), null)
  assert.equal(getSwipeDirection({ deltaX: -44, deltaY: 48, durationMs: 100 }), null)
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
  const mobileCss = await read('./mobile-navigation.css')
  const sheetCss = await read('./bottom-sheet.css')

  assert.match(mobileCss, /@media\s*\(max-width:\s*640px\)[\s\S]*\.modal-backdrop\s*\{[^}]*place-items:\s*center/s)
  assert.match(mobileCss, /\.modal-card\s*\{[^}]*max-height:\s*min\([^)]*dvh/s)
  assert.match(sheetCss, /\.bottom-sheet\s*\{[^}]*max-height:\s*min\([^)]*dvh/s)
  assert.match(sheetCss, /\.bottom-sheet-body\s*\{[^}]*overflow-y:\s*auto/s)
  assert.match(sheetCss, /\.bottom-sheet-body\s*\{[^}]*overscroll-behavior:\s*contain/s)
})
