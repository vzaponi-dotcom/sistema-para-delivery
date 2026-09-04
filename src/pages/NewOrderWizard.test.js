import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('new order exposes an accessible three-step indicator with reached-state awareness', async () => {
  const indicator = await read('../components/NewOrderStepIndicator.jsx')

  assert.match(indicator, /Etapas da nova venda/)
  assert.match(indicator, /Cliente/)
  assert.match(indicator, /Produtos/)
  assert.match(indicator, /Finalizar/)
  assert.match(indicator, /aria-current/)
  assert.match(indicator, /maxReachedStep/)
  assert.match(indicator, /disabled=\{!accessible\}/)
  assert.match(indicator, /onNavigate\(step\.id\)/)
})

test('new order starts on customer step and customer step contains only attendance data', async () => {
  const page = await read('./NewOrder.jsx')
  const customerStep = await read('../components/NewOrderCustomerStep.jsx')

  assert.match(page, /useState\(NEW_ORDER_STEPS\.CUSTOMER\)/)
  assert.match(page, /maxReachedStep/)
  assert.match(page, /NewOrderCustomerStep/)
  assert.match(customerStep, /Tipo do pedido/)
  assert.match(customerStep, /Data do pedido/)
  assert.match(customerStep, /\+ Novo cliente/)
  assert.match(customerStep, /Continuar/)
  assert.match(customerStep, /aria-pressed/)
  assert.doesNotMatch(customerStep, /OrderProductCatalog/)
  assert.doesNotMatch(customerStep, /OrderCart/)
  assert.doesNotMatch(customerStep, /OrderCheckoutSummary/)
})
