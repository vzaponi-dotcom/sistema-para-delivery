import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
test('reporting styles use semantic tokens and visible focus', async () => { const css = await readFile(new URL('./reporting.css', import.meta.url), 'utf8'); assert.match(css, /var\(--text\)/); assert.match(css, /:focus-visible/); assert.match(css, /prefers-reduced-motion/) })
