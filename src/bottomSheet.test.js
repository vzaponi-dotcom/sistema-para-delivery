import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('BottomSheet is focus-trapped and dismissible', async () => {
  const source = await read('./components/BottomSheet.jsx')
  assert.match(source, /role="dialog"/)
  assert.match(source, /aria-modal="true"/)
  assert.match(source, /event\.key === 'Escape'/)
  assert.match(source, /event\.key !== 'Tab'/)
  assert.match(source, /previousFocus/)
})

test('Modal keeps its accessible dialog behavior', async () => {
  const source = await read('./components/Modal.jsx')
  assert.match(source, /modal-backdrop/)
  assert.match(source, /role="dialog"/)
  assert.match(source, /aria-modal="true"/)
})

test('sheet CSS respects safe area and touch targets', async () => {
  const css = await read('./bottom-sheet.css')
  assert.match(css, /safe-area-inset-bottom/)
  assert.match(css, /min-height:\s*44px/)
  assert.match(css, /overscroll-behavior:\s*contain/)
})
