import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(path), 'utf8')

test('sidebar uses the compact meal icon instead of the detailed brand logo', () => {
  const source = read('src/components/Sidebar.jsx')
  assert.doesNotMatch(source, /BrandLogo/)
  assert.match(source, /className="sidebar-logo"[^>]*><Icon name="meal" size=\{24\}/)
  assert.match(source, /Amor &amp; Sabor/)
  assert.match(source, /Gestão do delivery/)
})

test('sidebar meal mark has a compact standalone treatment', () => {
  const css = read('src/brand.css')
  assert.match(css, /\.sidebar-logo[\s\S]*width:\s*40px/)
  assert.match(css, /\.sidebar-logo[\s\S]*border-radius:\s*12px/)
  assert.match(css, /\.sidebar-logo[\s\S]*display:\s*grid/)
  assert.match(css, /\.sidebar-logo[\s\S]*color:\s*#fff/)
  assert.match(css, /\.sidebar-logo svg[\s\S]*width:\s*24px/)
})
