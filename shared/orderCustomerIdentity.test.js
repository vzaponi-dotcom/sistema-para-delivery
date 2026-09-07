import test from 'node:test'
import assert from 'node:assert/strict'
import { CUSTOMER_IDENTITY_TYPES, validateCustomerIdentity } from './orderCustomerIdentity.js'

test('delivery and pickup require a registered client', () => {
  assert.equal(validateCustomerIdentity('Entrega', { type: 'guest_name', value: 'Ana' }).ok, false)
  assert.equal(validateCustomerIdentity('Retirada', { type: 'table', tableId: 'table-123' }).ok, false)
  assert.deepEqual(validateCustomerIdentity('Entrega', { type: 'registered_client', clientId: 'c1' }), {
    ok: true,
    value: { type: 'registered_client', clientId: 'c1' },
  })
})

test('local requires a table id and accepts an optional registered client', () => {
  assert.deepEqual(validateCustomerIdentity('Local', { type: 'table', tableId: ' table-123 ' }), {
    ok: true,
    value: { type: 'table', tableId: 'table-123' },
  })
  assert.deepEqual(validateCustomerIdentity('Local', { type: 'table', tableId: 'table-123', clientId: ' client-456 ' }), {
    ok: true,
    value: { type: 'table', tableId: 'table-123', clientId: 'client-456' },
  })
})

test('local rejects missing tables and legacy identity formats for new checkout', () => {
  assert.equal(validateCustomerIdentity('Local', { type: 'table' }).ok, false)
  assert.equal(validateCustomerIdentity('Local', { type: 'table', tableId: '   ' }).ok, false)
  assert.equal(validateCustomerIdentity('Local', { type: 'guest_name', value: 'João' }).ok, false)
  assert.equal(validateCustomerIdentity('Local', { type: 'registered_client', clientId: 'c1' }).ok, false)
})

test('guest name remains a recognized historical identity type', () => {
  assert.equal(CUSTOMER_IDENTITY_TYPES.includes('guest_name'), true)
})
