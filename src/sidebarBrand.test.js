import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(path), 'utf8')

test('operation brand lives in the global top bar instead of the sidebar', () => {
  const sidebar = read('src/app/shell/Sidebar.jsx')
  const topbar = read('src/app/shell/AppTopBar.jsx')

  assert.doesNotMatch(sidebar, /BrandLogo/)
  assert.doesNotMatch(sidebar, /className="sidebar-(?:logo|brand)"/)
  assert.doesNotMatch(sidebar, /Amor &amp; Sabor|Gestão do delivery/)
  assert.match(topbar, /<Icon name="meal" size=\{23\}/)
  assert.match(topbar, /'Amor & Sabor'/)
  assert.match(topbar, /'Gestão do delivery'/)
})

test('global top bar meal mark has the compact premium treatment', () => {
  const css = read('src/app-top-bar.css')

  assert.match(css, /\.app-topbar-brand-icon\s*\{[^}]*width:\s*36px[^}]*height:\s*36px/s)
  assert.match(css, /\.app-topbar-brand-icon\s*\{[^}]*border-radius:\s*12px/s)
  assert.match(css, /\.app-topbar-brand-icon\s*\{[^}]*background:\s*var\(--primary-soft\)/s)
  assert.match(css, /\.app-topbar-brand-icon\s*\{[^}]*color:\s*var\(--primary\)/s)
})
