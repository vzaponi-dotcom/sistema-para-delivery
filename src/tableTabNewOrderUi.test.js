import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync(new URL('./pages/NewOrder.jsx', import.meta.url), 'utf8')
const customerStep = fs.readFileSync(new URL('./components/NewOrderCustomerStep.jsx', import.meta.url), 'utf8')
const tableSelector = fs.readFileSync(new URL('./components/LocalTableSelector.jsx', import.meta.url), 'utf8')

test('occupied registered tables stay selectable and explain open-tab reuse', () => {
  assert.match(page, /selectedTable/)
  assert.match(customerStep, /tables=\{tables\}/)
  assert.match(customerStep, /selectedTableId=\{selectedTableId\}/)
  assert.match(customerStep, /onSelect=\{onTableSelect\}/)
  assert.match(tableSelector, /Comanda aberta — este pedido será adicionado à/)
  assert.doesNotMatch(page, /customerIdentity:[\s\S]*tableTabId/)
})
