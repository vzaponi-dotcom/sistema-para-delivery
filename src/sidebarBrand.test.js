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
  assert.match(topbar, /alt="Mesiva"/)
  assert.match(sidebar, /alt="Mesiva"/)
  assert.match(topbar, /businessName/)
  assert.match(topbar, /operationName/)
  assert.doesNotMatch(topbar, /'Amor & Sabor'/)
})
