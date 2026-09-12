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

test('dashboard no longer retains the removed new-order FAB', () => {
  const dashboard = read('src/pages/Dashboard.jsx')
  const dashboardCss = read('src/dashboard.css')
  assert.doesNotMatch(dashboard, /dashboard-new-order-fab/)
  assert.doesNotMatch(dashboardCss, /dashboard-new-order-fab/)
})
