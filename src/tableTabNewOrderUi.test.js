import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync(new URL('./domains/orders/ui/NewOrder.jsx', import.meta.url), 'utf8')
const customerStep = fs.readFileSync(new URL('./domains/orders/ui/components/NewOrderCustomerStep.jsx', import.meta.url), 'utf8')
const tableSelector = fs.readFileSync(new URL('./domains/table-service/ui/LocalTableSelector.jsx', import.meta.url), 'utf8')

test('occupied registered tables stay selectable and explain open-tab reuse', () => {
  assert.match(page, /selectedTable/)
  assert.match(customerStep, /tables=\{tables\}/)
  assert.match(customerStep, /selectedTableId=\{selectedTableId\}/)
  assert.match(customerStep, /onSelect=\{onTableSelect\}/)
  assert.match(customerStep, /from ['"]\.\.\/\.\.\/\.\.\/table-service\/index\.js['"]/)
  assert.doesNotMatch(customerStep, /table-service\/(domain|application|infrastructure|ui)\//)
  assert.match(tableSelector, /Comanda aberta — este pedido será adicionado à/)
  assert.doesNotMatch(page, /customerIdentity:[\s\S]*tableTabId/)
})
