import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const page = readFileSync(new URL('./pages/NewOrder.jsx', import.meta.url), 'utf8')
const customerStep = readFileSync(new URL('./components/NewOrderCustomerStep.jsx', import.meta.url), 'utf8')
const tableSelectorUrl = new URL('./components/LocalTableSelector.jsx', import.meta.url)
const tableSelector = existsSync(tableSelectorUrl) ? readFileSync(tableSelectorUrl, 'utf8') : ''

test('local orders require a registered active table without free-text identity modes', () => {
  assert.match(customerStep, /<LocalTableSelector/)
  assert.doesNotMatch(customerStep, /LOCAL_IDENTITY_OPTIONS/)
  assert.doesNotMatch(customerStep, /localIdentityType/)
  assert.doesNotMatch(customerStep, /localIdentityValue/)
  assert.match(tableSelector, /tables\.filter\(\(table\) => table\.isActive\)/)
  assert.match(tableSelector, /aria-pressed=\{selectedTableId === table\.id\}/)
  assert.match(tableSelector, /table\.occupancy === 'occupied' \? 'Ocupada' : 'Livre'/)
  assert.doesNotMatch(tableSelector, /disabled=\{[^}]*occupancy/)
})

test('local registered client stays optional while delivery client remains separate', () => {
  assert.match(customerStep, /Vincular cliente cadastrado — opcional/)
  assert.match(page, /const \[localClientId, setLocalClientId\] = useState\(''\)/)
  assert.match(page, /const \[clientId, setClientId\] = useState\(clients\[0\]\?\.id \?\? ''\)/)
  assert.match(page, /type === 'Local' \? localClientId : clientId/)
  assert.match(page, /identityValid: identityValidation\.ok/)
})
