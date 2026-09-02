import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOrderPayload } from './utils/orderCart.js'

const baseDraft = {
  type: 'Local',
  orderDate: '2026-09-02',
  items: [{ productId: 'p1', quantity: 1, note: '' }],
  deliveryFee: 0,
  adjustment: { type: 'none', mode: 'fixed', value: 0, reason: '' },
}

test('order payload sends explicit local customer identity without fake client id', () => {
  const payload = buildOrderPayload({
    ...baseDraft,
    customerIdentity: { type: 'guest_name', value: 'João' },
  })
  assert.deepEqual(payload.customerIdentity, { type: 'guest_name', value: 'João' })
  assert.equal(Object.hasOwn(payload, 'clientId'), false)
})

test('registered customer identity remains explicit in order payload', () => {
  const payload = buildOrderPayload({
    ...baseDraft,
    type: 'Entrega',
    clientId: 'c1',
    customerIdentity: { type: 'registered_client', clientId: 'c1' },
  })
  assert.deepEqual(payload.customerIdentity, { type: 'registered_client', clientId: 'c1' })
})
