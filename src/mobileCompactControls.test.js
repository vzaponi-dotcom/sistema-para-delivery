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

test('kitchen header actions fill the mobile width with four controls and a very-narrow fallback', async () => {
  const css = await read('./mobile-compact-controls.css')

  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.kitchen-page \.page-actions\s*\{[^}]*width:\s*100%/s)
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.kitchen-page \.kitchen-header-actions\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s)
  assert.match(css, /\.kitchen-page \.kitchen-header-actions \.button\s*\{[^}]*min-width:\s*0[^}]*white-space:\s*normal/s)
  assert.match(css, /@media\s*\(max-width:\s*340px\)[\s\S]*\.kitchen-page \.kitchen-header-actions\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s)
})
