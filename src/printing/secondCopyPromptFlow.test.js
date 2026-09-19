import test from 'node:test'
import assert from 'node:assert/strict'
import { rememberOriginOrderId, readOriginOrderIds } from './secondCopyPromptFlow.js'

test('persists only the creating browser order ids used to target remote prompts', () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  rememberOriginOrderId('order-origin', storage)
  rememberOriginOrderId('order-origin', storage)
  rememberOriginOrderId('order-next', storage)
  assert.deepEqual([...readOriginOrderIds(storage)].sort(), ['order-next', 'order-origin'])
})
