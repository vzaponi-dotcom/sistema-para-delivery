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
  const foundationCss = read('src/mobile-foundation.css')
  const dashboardCss = read('src/dashboard.css')
  assert.match(foundationCss, /--mobile-bottom-nav-height:\s*65px/)
  assert.match(foundationCss, /--mobile-floating-gap:\s*16px/)
  assert.match(foundationCss, /--layer-floating-action:\s*70/)
  assert.match(
    dashboardCss,
    /@media\s*\(max-width:\s*820px\)[\s\S]*\.dashboard-new-order-fab\s*\{[^}]*bottom:\s*calc\(var\(--mobile-bottom-nav-height\)\s*\+\s*var\(--mobile-floating-gap\)\s*\+\s*var\(--mobile-safe-bottom\)\)/s,
  )
  assert.match(dashboardCss, /\.dashboard-new-order-fab\s*\{[^}]*z-index:\s*var\(--layer-floating-action\)/s)
})
