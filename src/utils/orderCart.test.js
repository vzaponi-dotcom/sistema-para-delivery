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

test('percentage discount excludes delivery fee and payload contains no price', () => {
  const items = [...addCartItem([], marmita, ''), ...addCartItem([], coca, '')]
  const draft = {
    clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', items,
    deliveryFee: 8,
    adjustment: { type: 'discount', mode: 'percentage', value: 10, reason: ' fidelidade ' },
  }
  assert.deepEqual(calculateOrderPreview(draft), { subtotal: 40, deliveryFee: 8, adjustmentAmount: 4, total: 44 })
  const payload = buildOrderPayload(draft, 'Pix')
  assert.equal(payload.items[0].unitPrice, undefined)
  assert.equal(payload.paymentMethod, 'Pix')
  assert.equal(payload.adjustment.reason, 'fidelidade')
})

test('summary and search use every item and tolerate legacy fields', () => {
  const order = { items: [{ name: 'Marmita G', quantity: 2 }, { name: 'Coca-Cola', quantity: 1 }] }
  assert.match(getOrderItemsSummary(order), /Coca-Cola/)
  assert.match(getOrderItemsSearchText(order).toLowerCase(), /coca-cola/)
  assert.equal(getOrderItems({ productName: 'Pudim', quantity: 1, size: '' })[0].name, 'Pudim')
})

test('multi-item search finds any product and legacy order stays readable', () => {
  assert.match(getOrderItemsSearchText({ items: [{ name: 'Marmita G' }, { name: 'Pudim' }] }).toLowerCase(), /pudim/)
  assert.equal(getOrderItems({ productName: 'Marmita P', size: 'P', quantity: 2 })[0].quantity, 2)
})
