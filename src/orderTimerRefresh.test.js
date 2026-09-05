import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('orders receive the shared kitchen clock instead of owning a minute timer', async () => {
  const source = await read('./pages/Orders.jsx')
  assert.match(source, /function Orders\(\{[^}]*\bnow\b/)
  assert.doesNotMatch(source, /setInterval[\s\S]*60_000/)
  assert.doesNotMatch(source, /setNow/)
})
