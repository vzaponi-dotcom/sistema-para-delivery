import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('./pages/NewOrder.jsx', import.meta.url), 'utf8')
const customerStep = readFileSync(new URL('./components/NewOrderCustomerStep.jsx', import.meta.url), 'utf8')

test('local orders offer name table or registered client identity modes', () => {
  assert.match(customerStep, /guest_name/)
  assert.match(customerStep, /table/)
  assert.match(customerStep, /registered_client/)
  assert.match(customerStep, /Nome/)
  assert.match(customerStep, /Mesa/)
  assert.match(customerStep, /Cliente cadastrado/)
})

test('registered client remains mandatory outside local orders', () => {
  assert.match(page, /type === 'Local'/)
  assert.match(page, /customerIdentity/)
  assert.match(page, /canSubmit/)
})
