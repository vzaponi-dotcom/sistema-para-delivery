import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('SystemSelect exposes accessible combobox and listbox behavior', async () => {
  const source = await read('./components/SystemSelect.jsx')
  assert.match(source, /role="combobox"/)
  assert.match(source, /aria-expanded=/)
  assert.match(source, /role="listbox"/)
  assert.match(source, /role="option"/)
  assert.match(source, /aria-selected=/)
  assert.match(source, /event\.key === 'Escape'/)
  assert.match(source, /ArrowDown/)
  assert.match(source, /ArrowUp/)
  assert.match(source, /onChange\(option\.value\)/)
})

test('SystemSelect renders one presentation for the current viewport and reuses BottomSheet on mobile', async () => {
  const source = await read('./components/SystemSelect.jsx')
  assert.match(source, /BottomSheet/)
  assert.match(source, /const mobileQuery = '\(max-width: 820px\)'/)
  assert.match(source, /matchMedia\(mobileQuery\)/)
  assert.match(source, /mobile \?/)
  assert.match(source, /system-select-dropdown/)
})

test('SystemSelect desktop dropdown is anchored and controls remain touch friendly', async () => {
  const css = await read('./system-select.css')
  assert.match(css, /\.system-select-dropdown/)
  assert.match(css, /position:\s*absolute/)
  assert.match(css, /@media\s*\(max-width:\s*820px\)/)
  assert.match(css, /min-height:\s*44px/)
  assert.match(css, /var\(--surface\)/)
  assert.match(css, /var\(--primary\)/)
})
