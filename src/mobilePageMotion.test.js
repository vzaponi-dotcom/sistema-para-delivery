import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(path), 'utf8')

test('mobile app shell marks page direction for animated section changes', () => {
  const shell = read('src/components/AppShell.jsx')
  assert.match(shell, /page-transition/)
  assert.match(shell, /data-direction/)
  assert.match(shell, /previousTab/)
})

test('mobile page transition is smooth and disabled for reduced motion', () => {
  const css = read('src/mobile-navigation.css')
  assert.match(css, /@keyframes mobile-page/)
  assert.match(css, /animation:\s*mobile-page-(?:forward|backward)\s+300ms\s+cubic-bezier/)
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
})

test('dashboard new-order fab sits above the fixed mobile navigation', () => {
  const mobileCss = read('src/mobile-navigation.css')
  const dashboardCss = read('src/dashboard.css')
  assert.match(mobileCss, /--mobile-bottom-nav-height:\s*65px/)
  assert.match(
    dashboardCss,
    /@media\s*\(max-width:\s*820px\)[\s\S]*\.dashboard-new-order-fab\s*\{[^}]*bottom:\s*calc\(var\(--mobile-bottom-nav-height\)\s*\+\s*16px\s*\+\s*env\(safe-area-inset-bottom\)\)/s,
  )
  assert.match(dashboardCss, /\.dashboard-new-order-fab\s*\{[^}]*z-index:\s*(?:6[1-9]|[7-9]\d|\d{3,})/s)
})
