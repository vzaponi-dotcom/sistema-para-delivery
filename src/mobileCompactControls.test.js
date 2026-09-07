import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile compact controls stylesheet is wired from the application entrypoint', async () => {
  const main = await read('./main.jsx')

  assert.match(main, /import '\.\/mobile-compact-controls\.css'/)
})

test('order type choices stay three-across and compact on mobile', async () => {
  const css = await read('./mobile-compact-controls.css')

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.new-order-type-options\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s)
  assert.match(css, /\.new-order-type-options\s*>\s*\.new-order-type-option\s*\{[^}]*min-height:\s*var\(--mobile-touch-target,\s*44px\)[^}]*white-space:\s*normal/s)
})
