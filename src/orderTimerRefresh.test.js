import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('orders refresh elapsed time every minute and immediately after app resume', async () => {
  const source = await read('./pages/Orders.jsx')
  assert.match(source, /setInterval[\s\S]*60_000/)
  assert.match(source, /visibilitychange/)
  assert.match(source, /document\.visibilityState === 'visible'/)
  assert.match(source, /window\.addEventListener\('focus'/)
  assert.match(source, /removeEventListener\('focus'/)
})
