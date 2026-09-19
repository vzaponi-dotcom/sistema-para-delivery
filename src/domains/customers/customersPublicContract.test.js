import test from 'node:test'
import assert from 'node:assert/strict'

test('Customers exposes the frontend duplicate contracts through its public entry', async () => {
  const customers = await import('./index.js')

  assert.equal(typeof customers.normalizeClientName, 'function')
  assert.equal(typeof customers.findClientDuplicates, 'function')
})


test('Customers exposes Clients UI from the public entry', async () => {
  const customers = await import('./index.js')
  assert.equal(typeof customers.Clients, 'function')
})
