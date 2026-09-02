import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addCartItem, buildOrderPayload, calculateOrderPreview,
  getOrderItems, getOrderItemsSearchText, getOrderItemsSummary,
  removeCartItem, updateCartItem,
} from './orderCart.js'

const marmita = { id: 'p1', name: 'Marmita G', category: 'Marmita', size: 'G', price: 32 }
const coca = { id: 'p2', name: 'Coca-Cola', category: 'Bebida', size: 'Lata', price: 8 }

test('same product and normalized note merge quantity', () => {
  let items = addCartItem([], marmita, ' sem   cebola ')
  items = addCartItem(items, marmita, 'Sem cebola')
  assert.equal(items.length, 1)
  assert.equal(items[0].quantity, 2)
  assert.equal(items[0].note, 'sem cebola')
})

test('different notes stay separate and editing can consolidate them', () => {
  let items = addCartItem([], marmita, 'sem cebola')
  items = addCartItem(items, marmita, 'sem salada')
  items = updateCartItem(items, items[1].lineId, { note: '  SEM CEBOLA ' })
  assert.equal(items.length, 1)
  assert.equal(items[0].quantity, 2)
})

test('quantity never drops below one and remove deletes the line', () => {
  let items = addCartItem([], coca, '')
  items = updateCartItem(items, items[0].lineId, { quantity: 0 })
  assert.equal(items[0].quantity, 1)
  assert.deepEqual(removeCartItem(items, items[0].lineId), [])
})
