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

test('local checkout requires table identity and accepts an optional client', () => {
  const withoutClient = validateCheckoutInput({
    ...baseCheckout,
    clientId: undefined,
    type: 'Local',
    customerIdentity: { type: 'table', tableId: ' table-123 ' },
  }, 'table-key')

  assert.deepEqual(withoutClient.customerIdentity, { type: 'table', tableId: 'table-123' })

  const withClient = validateCheckoutInput({
    ...baseCheckout,
    clientId: undefined,
    type: 'Local',
    customerIdentity: { type: 'table', tableId: 'table-123', clientId: ' client-456 ' },
  }, 'table-client-key')

  assert.deepEqual(withClient.customerIdentity, {
    type: 'table',
    tableId: 'table-123',
    clientId: 'client-456',
  })
})

test('new local checkout rejects missing table, guest name, and client-only identity', () => {
  const invalidIdentities = [
    { type: 'table' },
    { type: 'guest_name', value: 'João' },
    { type: 'registered_client', clientId: 'c1' },
  ]

  for (const customerIdentity of invalidIdentities) {
    assert.throws(() => validateCheckoutInput({
      ...baseCheckout,
      clientId: undefined,
      type: 'Local',
      customerIdentity,
    }, 'invalid-local-key'), (error) => error.status === 400 && error.code === 'VALIDATION_ERROR')
  }
})

test('delivery rejects table identity', () => {
  assert.throws(() => validateCheckoutInput({
    ...baseCheckout,
    clientId: undefined,
    type: 'Entrega',
    customerIdentity: { type: 'table', tableId: 'table-123' },
  }, 'delivery-key'), /cliente cadastrado/i)
})

test('pickup accepts only a registered client with clientId', () => {
  assert.deepEqual(validateCheckoutInput({
    ...baseCheckout,
    customerIdentity: { type: 'registered_client', clientId: ' client-123 ' },
  }, 'pickup-key').customerIdentity, {
    type: 'registered_client',
    clientId: 'client-123',
  })
})

test('legacy clientId payload remains compatible as registered client', () => {
  const input = validateCheckoutInput({ ...baseCheckout, customerIdentity: undefined }, 'legacy-key')
  assert.deepEqual(input.customerIdentity, { type: 'registered_client', clientId: 'c1' })
})
