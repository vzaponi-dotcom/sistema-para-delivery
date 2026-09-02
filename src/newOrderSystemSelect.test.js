import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('NewOrder uses SystemSelect for order type', async () => {
  const source = await read('./pages/NewOrder.jsx')
  assert.match(source, /import SystemSelect/)
  assert.match(source, /label="Tipo do pedido"/)
  assert.doesNotMatch(source, /<select/)
})

test('checkout uses SystemSelect for adjustment mode and payment', async () => {
  const source = await read('./components/OrderCheckoutSummary.jsx')
  for (const label of ['Ajuste do pedido', 'Modo', 'Forma de pagamento']) assert.match(source, new RegExp(`label="${label}"`))
  assert.doesNotMatch(source, /<select/)
})
