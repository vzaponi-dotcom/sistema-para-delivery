import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync(new URL('./pages/NewOrder.jsx', import.meta.url), 'utf8')
const customerStep = fs.readFileSync(new URL('./components/NewOrderCustomerStep.jsx', import.meta.url), 'utf8')

test('new order shows active table tab context without sending tab id', () => {
  assert.match(page, /tableTabs/)
  assert.match(page, /openTableTab/)
  assert.match(customerStep, /comanda aberta/)
  assert.doesNotMatch(page, /customerIdentity:[\s\S]*tableTabId/)
})
