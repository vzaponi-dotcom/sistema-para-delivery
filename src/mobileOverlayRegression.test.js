import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('modal and bottom sheet lock background scroll and restore focus', async () => {
  const modal = await read('./components/Modal.jsx')
  const sheet = await read('./components/BottomSheet.jsx')
  for (const source of [modal, sheet]) {
    assert.match(source, /acquireScrollLock/)
    assert.match(source, /previousFocus/)
    assert.match(source, /event\.key === 'Escape'/)
  }
})

test('nested overlay keyboard handling belongs only to the topmost dialog', async () => {
  const modal = await read('./components/Modal.jsx')
  const sheet = await read('./components/BottomSheet.jsx')
  assert.match(modal, /isTopmostDialog/); assert.match(sheet, /isTopmostDialog/)
  assert.match(modal, /if \(!isTopmostDialog\(cardRef\.current\)\) return/)
  assert.match(sheet, /if \(!isTopmostDialog\(sheetRef\.current\)\) return/)
})

test('mobile overlays use dynamic viewport sizing and internal scrolling', async () => {
  const foundation = await read('./mobile-foundation.css')
  const sheetCss = await read('./bottom-sheet.css')
  const selectCss = await read('./system-select.css')
  assert.match(foundation, /\.modal-card\s*\{[^}]*max-height:\s*var\(--mobile-overlay-max-height\)/s)
  assert.match(foundation, /\.modal-body\s*\{[^}]*overflow-y:\s*auto[^}]*overscroll-behavior:\s*contain/s)
  assert.match(sheetCss, /\.bottom-sheet\s*\{[^}]*max-height:\s*var\(--mobile-overlay-max-height\)/s)
  assert.match(sheetCss, /\.bottom-sheet-body\s*\{[^}]*overflow-y:\s*auto[^}]*overscroll-behavior:\s*contain/s)
  assert.match(selectCss, /\.system-select-sheet-option\s*\{[^}]*min-height:\s*(?:48px|var\(--mobile-touch-target\))/s)
})

test('new confirmation and cancellation review dialogs inherit the mobile-safe modal shell', async () => {
  const confirmation = await read('./components/ConfirmationDialog.jsx')
  const cancellation = await read('./components/CancelOrderDialog.jsx')
  const foundation = await read('./mobile-foundation.css')
  const appCss = await read('./App.css')

  assert.match(confirmation, /<Modal/)
  assert.match(confirmation, /form-actions/)
  assert.match(cancellation, /<Modal/)
  assert.match(cancellation, /form-actions/)
  assert.match(foundation, /@media\s*\(max-width:\s*640px\)/)
  assert.match(foundation, /body > \.modal-backdrop > \.modal-card\s*\{[^}]*max-height:\s*var\(--mobile-overlay-max-height\)/s)
  assert.match(appCss, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.form-actions\s*\{[^}]*flex-direction:\s*column-reverse/s)
  assert.match(appCss, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.form-actions \.button\s*\{[^}]*width:\s*100%/s)
})

test('shared overlay layers keep sheets above modals without magic z-index drift', async () => {
  const foundation = await read('./mobile-foundation.css')
  const sheetCss = await read('./bottom-sheet.css')
  assert.match(foundation, /--layer-overlay:\s*100/)
  assert.match(foundation, /--layer-overlay-raised:\s*110/)
  assert.match(sheetCss, /z-index:\s*var\(--layer-overlay-raised\)/)
})
