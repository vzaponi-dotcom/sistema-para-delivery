import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile foundation owns viewport safe-area and shared tokens', async () => {
  const css = await read('./mobile-foundation.css')
  assert.match(css, /--mobile-bottom-nav-height:\s*65px/)
  assert.match(css, /--mobile-safe-bottom:\s*env\(safe-area-inset-bottom/)
  assert.match(css, /--mobile-touch-target:\s*44px/)
  assert.match(css, /--mobile-overlay-max-height:\s*min\(88dvh,\s*720px\)/)
  assert.match(css, /\.app-main\s*\{[^}]*overflow-x:\s*clip/s)
  assert.doesNotMatch(css, /\.app-main\s*\{[^}]*touch-action:\s*pan-y\s+pinch-zoom/s)
  assert.match(css, /html,\s*body,\s*#root\s*\{[^}]*overflow-x:\s*clip/s)
})

test('navigation no longer owns shared structural tokens', async () => {
  const nav = await read('./mobile-navigation.css')
  const dashboard = await read('./dashboard.css')
  assert.doesNotMatch(nav, /--mobile-bottom-nav-height:\s*65px/)
  assert.match(dashboard, /var\(--mobile-bottom-nav-height\)/)
  assert.match(dashboard, /var\(--mobile-floating-gap\)/)
})
