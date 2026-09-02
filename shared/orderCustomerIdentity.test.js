import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCustomerIdentity } from './orderCustomerIdentity.js'

test('delivery and pickup require a registered client', () => {
  assert.equal(validateCustomerIdentity('Entrega', { type: 'guest_name', value: 'Ana' }).ok, false)
  assert.equal(validateCustomerIdentity('Retirada', { type: 'table', value: '04' }).ok, false)
  assert.deepEqual(validateCustomerIdentity('Entrega', { type: 'registered_client', clientId: 'c1' }), {
    ok: true,
    value: { type: 'registered_client', clientId: 'c1' },
  })
})

test('local accepts registered client guest name and table', () => {
  assert.deepEqual(validateCustomerIdentity('Local', { type: 'guest_name', value: '  João  ' }), {
    ok: true,
    value: { type: 'guest_name', value: 'João' },
  })
  assert.deepEqual(validateCustomerIdentity('Local', { type: 'table', value: 'A-2' }), {
    ok: true,
    value: { type: 'table', value: 'A-2' },
  })
  assert.equal(validateCustomerIdentity('Local', { type: 'registered_client', clientId: 'c1' }).ok, true)
})

test('local identity enforces approved name and table limits', () => {
  assert.equal(validateCustomerIdentity('Local', { type: 'table', value: 'Mesa 2' }).ok, false)
  assert.equal(validateCustomerIdentity('Local', { type: 'table', value: 'ABCDEFGHIJKLM' }).ok, false)
  assert.equal(validateCustomerIdentity('Local', { type: 'guest_name', value: '' }).ok, false)
  assert.equal(validateCustomerIdentity('Local', { type: 'guest_name', value: 'x'.repeat(81) }).ok, false)
})
