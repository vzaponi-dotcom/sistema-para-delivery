import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateCheckoutTotals, validateCheckoutInput } from './orderCheckout.js'

test('checkout converts fee and percentage to storage units', () => {
  const input = validateCheckoutInput({
    clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01',
    items: [{ productId: 'p1', quantity: 2, note: ' sem   cebola ' }],
    deliveryFee: 8,
    adjustment: { type: 'discount', mode: 'percentage', value: 7.5, reason: ' fidelidade ' },
    paymentMethod: 'Pix',
  }, 'checkout-1')
  assert.equal(input.items[0].note, 'sem cebola')
  assert.equal(input.deliveryFeeCents, 800)
  assert.equal(input.adjustment.storedValue, 750)
  assert.equal(input.adjustment.reason, 'fidelidade')
  assert.equal(input.paymentMethod, 'Pix')
})

test('checkout merges duplicate product and equivalent normalized note', () => {
  const input = validateCheckoutInput({
    clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01',
    items: [
      { productId: 'p1', quantity: 1, note: ' sem   cebola ' },
      { productId: 'p1', quantity: 2, note: 'SEM CEBOLA' },
      { productId: 'p1', quantity: 1, note: 'sem salada' },
    ],
  }, 'checkout-merge')
  assert.equal(input.items.length, 2)
  assert.equal(input.items[0].quantity, 3)
  assert.equal(input.items[0].note, 'sem cebola')
})

test('checkout rejects empty cart, long note, bad percentage and fee outside Entrega', () => {
  assert.throws(() => validateCheckoutInput({ clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', items: [] }, 'k'))
  assert.throws(() => validateCheckoutInput({ clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', items: [{ productId: 'p1', quantity: 1, note: 'x'.repeat(301) }] }, 'k'))
  assert.throws(() => validateCheckoutInput({ clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', items: [{ productId: 'p1', quantity: 1 }], adjustment: { type: 'discount', mode: 'percentage', value: 100.01 } }, 'k'))
  assert.throws(() => validateCheckoutInput({ clientId: 'c1', type: 'Retirada', orderDate: '2026-09-01', items: [{ productId: 'p1', quantity: 1 }], deliveryFee: 5 }, 'k'))
})

test('checkout rejects malformed percentage precision and invalid payment', () => {
  assert.throws(() => validateCheckoutInput({ clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', items: [{ productId: 'p1', quantity: 1 }], adjustment: { type: 'discount', mode: 'percentage', value: 7.555 } }, 'k'))
  assert.throws(() => validateCheckoutInput({ clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', items: [{ productId: 'p1', quantity: 1 }], paymentMethod: 'Cheque' }, 'k'))
})

test('discount percentage applies to products only and cannot consume fee', () => {
  assert.deepEqual(calculateCheckoutTotals(
    [{ quantity: 2, priceCents: 3200 }, { quantity: 1, priceCents: 800 }], 800,
    { type: 'discount', mode: 'percentage', storedValue: 1000 },
  ), { subtotalCents: 7200, adjustmentAmountCents: 720, totalCents: 7280 })

  assert.deepEqual(calculateCheckoutTotals(
    [{ quantity: 1, priceCents: 1000 }], 500,
    { type: 'discount', mode: 'fixed', storedValue: 2000 },
  ), { subtotalCents: 1000, adjustmentAmountCents: 1000, totalCents: 500 })
})
