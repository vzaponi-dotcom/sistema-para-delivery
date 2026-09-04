import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('NewOrder customer step uses pressed options for order type', async () => {
  const page = await read('./pages/NewOrder.jsx')
  const customerStep = await read('./components/NewOrderCustomerStep.jsx')

  assert.doesNotMatch(page, /import SystemSelect/)
  assert.match(customerStep, /aria-label="Tipo do pedido"/)
  assert.match(customerStep, /aria-pressed=\{type === option\.value\}/)
  assert.match(customerStep, /Entrega/)
  assert.match(customerStep, /Retirada/)
  assert.match(customerStep, /Consumo no local/)
  assert.doesNotMatch(customerStep, /<select/)
})

test('checkout uses SystemSelect for adjustment mode and payment', async () => {
  const source = await read('./components/OrderCheckoutSummary.jsx')
  for (const label of ['Ajuste do pedido', 'Modo', 'Forma de pagamento']) assert.match(source, new RegExp(`label="${label}"`))
  assert.doesNotMatch(source, /<select/)
})
