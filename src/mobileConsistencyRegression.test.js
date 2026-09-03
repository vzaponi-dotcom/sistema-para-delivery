import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('touch feedback does not depend on hover', async () => {
  const app = await read('./App.css')
  assert.match(app, /@media\s*\(hover:\s*none\)/)
  assert.match(app, /\.button:active/)
})

test('mobile toast stays above bottom navigation', async () => {
  const foundation = await read('./mobile-foundation.css')
  assert.match(foundation, /\.toast-success[\s\S]*var\(--mobile-bottom-nav-height\)/)
  assert.match(foundation, /\.toast-success\s*\{[^}]*z-index:\s*var\(--layer-toast\)/s)
})

test('reduced motion remains available for mobile transitions', async () => {
  const nav = await read('./mobile-navigation.css')
  assert.match(nav, /prefers-reduced-motion:\s*reduce/)
  assert.match(nav, /animation:\s*none/)
})
