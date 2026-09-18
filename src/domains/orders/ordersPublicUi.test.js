import assert from 'node:assert/strict'
import test from 'node:test'
import { NewOrderRoute, OrderDetail, OrderHistory, Orders } from './index.js'

test('Orders public boundary exposes all order surfaces', () => {
  assert.equal(typeof Orders, 'function')
  assert.equal(typeof OrderDetail, 'function')
  assert.equal(typeof OrderHistory, 'function')
  assert.equal(typeof NewOrderRoute, 'function')
})
