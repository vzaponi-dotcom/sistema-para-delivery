import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('reporting styles use semantic tokens, visible focus and stable tab overflow', async () => {
  const css = await readFile(new URL('./reporting.css', import.meta.url), 'utf8')
  assert.match(css, /var\(--text\)/)
  assert.match(css, /:focus-visible/)
  assert.match(css, /prefers-reduced-motion/)
  assert.match(css, /\.reporting-tabs[\s\S]*overflow-y:\s*hidden/)
  assert.match(css, /scrollbar-width:\s*none/)
  assert.match(css, /reporting-comparison-visual-row/)
  assert.match(css, /reporting-money-split-track[\s\S]*height:\s*22px/)
  assert.match(css, /reporting-comparison-unavailable/)
  assert.match(css, /reporting-metric-card:is\(button\):focus-visible/)
  assert.match(css, /border-color:\s*color-mix\(in srgb, var\(--primary\) 32%/)
  assert.match(css, /reporting-products-secondary-grid[\s\S]*align-items:\s*stretch/)
  assert.match(css, /reporting-products-insights[\s\S]*grid-template-rows:\s*repeat\(3, minmax\(0, 1fr\)\)/)
})
