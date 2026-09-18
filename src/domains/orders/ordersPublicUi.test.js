import assert from 'node:assert/strict'
import test from 'node:test'
import { NewOrderRoute } from './index.js'

test('Orders exports NewOrderRoute as a composition surface', () => {
  assert.equal(typeof NewOrderRoute, 'function')
})
