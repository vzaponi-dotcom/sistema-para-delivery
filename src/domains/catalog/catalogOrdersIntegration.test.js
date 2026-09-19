import test from 'node:test'
import assert from 'node:assert/strict'
import { addCartItem, decrementCartProduct, getCartProductQuantity, buildOrderPayload } from '../orders/domain/orderCart.js'

const base = { id: 'p1', name: 'Água', category: 'Bebidas', price: 3.5 }

test('C8 characterization preserves cart presentation, price and quantity for unit and volume', () => {
  for (const [product, size] of [
    [{ ...base, presentationType: 'unit' }, 'Un'],
    [{ ...base, presentationType: 'volume', presentationValue: '1.5', presentationUnit: 'L' }, '1,5 L'],
    [{ ...base, size: 'Família' }, 'Família'],
  ]) {
    const initial = addCartItem([], product)
    assert.equal(initial[0].size, size)
    assert.equal(initial[0].name, product.name)
    assert.equal(initial[0].category, product.category)
    assert.equal(initial[0].unitPrice, product.price)
    assert.equal(initial[0].quantity, 1)
    const increased = addCartItem(initial, product)
    assert.equal(increased.length, 1)
    assert.equal(getCartProductQuantity(increased, product.id), 2)
    assert.equal(initial[0].quantity, 1)
    const decreased = decrementCartProduct(increased, product.id)
    assert.equal(decreased[0].size, size)
    assert.equal(getCartProductQuantity(decreased, product.id), 1)
    assert.deepEqual(decrementCartProduct(decreased, product.id), [])
  }
})

test('C8 characterization leaves checkout items independent of Catalog presentation metadata', () => {
  const product = { ...base, presentationType: 'unit' }
  const items = addCartItem([], product, '  sem   gelo  ')
  const payload = buildOrderPayload({ items, type: 'Retirada', customerIdentity: { kind: 'registered_client', clientId: 'c1' } })
  assert.deepEqual(payload.items, [{ productId: 'p1', quantity: 1, note: 'sem gelo' }])
})
