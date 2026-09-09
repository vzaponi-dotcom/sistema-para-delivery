import assert from 'node:assert/strict'
import test from 'node:test'
import { formatOrderDisplayNumber } from './orderDisplayNumber.js'

test('formats the official operational order number and never derives from UUID', () => {
  assert.equal(formatOrderDisplayNumber({ orderNumber: 58, id: '550e8400-e29b-41d4-a716-446655440000' }), 'Pedido #58')
  assert.equal(formatOrderDisplayNumber({ orderNumber: 0, id: '550e8400-e29b-41d4-a716-446655440000' }), 'Pedido')
  assert.equal(formatOrderDisplayNumber({ id: 'order-0184' }), 'Pedido')
})
