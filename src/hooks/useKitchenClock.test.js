import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('kitchen clock delegates exact boundaries and keeps minute/resume as fallbacks', async () => {
  const source = await read('./useKitchenClock.js')
  assert.match(source, /scheduleKitchenTransitions/)
  assert.match(source, /setInterval[\s\S]*60_000/)
  assert.match(source, /visibilitychange/)
  assert.match(source, /focus/)
  assert.match(source, /clearInterval/)
})
