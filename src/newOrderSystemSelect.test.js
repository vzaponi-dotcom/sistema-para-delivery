import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('NewOrder customer step uses pressed options for order type', async () => {
  const page = await read('./domains/orders/ui/NewOrder.jsx')
  const customerStep = await read('./domains/orders/ui/components/NewOrderCustomerStep.jsx')
  const orderTypes = await read('./domains/orders/domain/orderTypeOptions.js')

  assert.doesNotMatch(page, /import SystemSelect/)
  assert.match(customerStep, /aria-label="Tipo do pedido"/)
  assert.match(customerStep, /aria-pressed=\{type === option\.value\}/)
  assert.match(customerStep, /orderTypeOptions = ORDER_TYPE_OPTIONS/)
  assert.match(customerStep, /orderTypeOptions\.map/)
  assert.match(orderTypes, /Entrega/)
  assert.match(orderTypes, /Retirada/)
  assert.match(orderTypes, /Consumo no local/)
  assert.doesNotMatch(customerStep, /<select/)
})

test('checkout keeps adjustment selects in orders and delegates payment composition to the app', async () => {
  const checkout = await read('./domains/orders/ui/components/OrderCheckoutSummary.jsx')
  const paymentComposition = await read('./app/workflows/payments/CheckoutPaymentComposition.jsx')
  for (const label of ['Ajuste do pedido', 'Modo']) assert.match(checkout, new RegExp(`label="${label}"`))
  assert.match(checkout, /renderPaymentComposition/)
  assert.doesNotMatch(checkout, /Forma de pagamento/)
  assert.match(paymentComposition, /PaymentCompositionEditor/)
  assert.doesNotMatch(checkout, /<select/)
})
