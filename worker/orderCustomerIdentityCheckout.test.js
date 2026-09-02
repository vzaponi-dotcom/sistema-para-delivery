import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCheckoutInput } from './orderCheckout.js'

const baseCheckout = {
  clientId: 'c1',
  type: 'Retirada',
  orderDate: '2026-09-02',
  items: [{ productId: 'p1', quantity: 1, note: '' }],
  deliveryFee: 0,
  adjustment: { type: 'none', mode: 'fixed', value: 0, reason: '' },
}

test('local checkout accepts guest identity while delivery rejects table identity', () => {
  const guest = validateCheckoutInput({
    ...baseCheckout,
    clientId: undefined,
    type: 'Local',
    customerIdentity: { type: 'guest_name', value: '  João  ' },
  }, 'guest-key')

  assert.deepEqual(guest.customerIdentity, { type: 'guest_name', value: 'João' })

  assert.throws(() => validateCheckoutInput({
    ...baseCheckout,
    clientId: undefined,
    type: 'Entrega',
    customerIdentity: { type: 'table', value: '04' },
  }, 'delivery-key'), /cliente cadastrado/i)
})

test('legacy clientId payload remains compatible as registered client', () => {
  const input = validateCheckoutInput({ ...baseCheckout, customerIdentity: undefined }, 'legacy-key')
  assert.deepEqual(input.customerIdentity, { type: 'registered_client', clientId: 'c1' })
})
