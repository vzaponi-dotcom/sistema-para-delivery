import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('touch feedback does not depend on hover', async () => {
  const interactions = await read('./mobile-interactions.css')
  const indexCss = await read('./index.css')

  assert.match(indexCss, /@import '\.\/mobile-interactions\.css'/)
  assert.match(interactions, /@media\s*\(hover:\s*none\)/)
  assert.match(interactions, /\.button:active/)
})

test('mobile toast is viewport anchored and cannot stretch between top and bottom', async () => {
  const app = await read('./App.jsx')
  const foundation = await read('./mobile-foundation.css')
  const interactions = await read('./mobile-interactions.css')
  const polish = await read('./ui-polish.css')

  assert.match(app, /import\s+\{\s*createPortal\s*\}\s+from\s+'react-dom'/)
  assert.match(app, /createPortal\([\s\S]*toast-success[\s\S]*document\.body\s*,?\s*\)/)
  assert.match(polish, /@media\s*\(max-width:\s*640px\)[\s\S]*\.toast-success\s*\{[^}]*top:\s*70px[^}]*bottom:\s*auto/s)
  assert.doesNotMatch(foundation, /\.toast-success\s*\{[^}]*bottom:/s)
  assert.doesNotMatch(interactions, /body\s+\.toast-success\s*\{[^}]*bottom:/s)
  assert.match(interactions, /body\s*>\s*\.toast-success\s*\{[^}]*z-index:\s*var\(--layer-toast\)/s)
})

test('reduced motion remains available for mobile transitions', async () => {
  const nav = await read('./mobile-navigation.css')
  assert.match(nav, /prefers-reduced-motion:\s*reduce/)
  assert.match(nav, /animation:\s*none/)
})
