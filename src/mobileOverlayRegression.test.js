import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness } from './test-support/renderWorkspace.js'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('modal and bottom sheet lock background scroll and restore focus on Escape', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
  for (const path of ['/src/components/Modal.jsx', '/src/components/BottomSheet.jsx']) {
    const { default: Overlay } = await h.load(path)
    const launcher = { focus() { h.document.activeElement = this } }
    const control = { focus() { h.document.activeElement = this } }
    const host = { querySelectorAll: () => [control] }
    h.document.body.style.overflow = 'auto'
    launcher.focus()
    function OpenOverlay() {
      const [open, setOpen] = React.useState(true)
      return open ? React.createElement(Overlay, { open, title: 'Teste', onClose: () => setOpen(false) }) : null
    }
    const r = await h.render(OpenOverlay, {}, { createNodeMock: (node) => node.props.role === 'dialog' ? host : null })
    h.document.querySelectorAll = () => r.root.findAllByProps({ role: 'dialog' }).map(() => host)
    assert.equal(h.document.body.style.overflow, 'hidden')
    assert.equal(h.document.activeElement, control)
    await act(async () => h.document.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' })))
    assert.equal(r.root.findAllByProps({ role: 'dialog' }).length, 0)
    assert.equal(h.document.body.style.overflow, 'auto')
    assert.equal(h.document.activeElement, launcher)
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
