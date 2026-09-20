import test from 'node:test'
import assert from 'node:assert/strict'

test('Customers exposes the external duplicate contracts through its public entry', async () => {
  const customers = await import('./index.js')

  assert.equal(typeof customers.findClientDuplicates, 'function')
})


test('Customers exposes its composition and quick-create contracts through the public entry', async () => {
  const customers = await import('./index.js')
  assert.equal(typeof customers.CustomersWorkspace, 'function')
  assert.equal(typeof customers.useQuickCreateCustomerCommand, 'function')
})
