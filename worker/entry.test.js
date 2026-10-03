import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
test('configured Worker entry exports only runtime handlers, never configuration constants', async () => {
  const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'))
  const entry = await import(new URL(`../${config.main}`, import.meta.url))
  for (const [name, value] of Object.entries(entry)) assert.ok(typeof value === 'function' || value && typeof value.fetch === 'function', `Unsupported Worker export: ${name}`)
})
