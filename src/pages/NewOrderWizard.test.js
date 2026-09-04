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

test('products step focuses on catalog and exposes a subtotal-only cart summary', async () => {
  const productsStep = await read('../components/NewOrderProductsStep.jsx')
  const cartSummary = await read('../components/NewOrderCartSummary.jsx')

  assert.match(productsStep, /OrderProductCatalog/)
  assert.match(productsStep, /NewOrderCartSummary/)
  assert.match(productsStep, /new-order-mobile-cart-action/)
  assert.match(productsStep, /Voltar/)
  assert.doesNotMatch(productsStep, /OrderCheckoutSummary/)
  assert.doesNotMatch(productsStep, /Taxa de entrega/)
  assert.doesNotMatch(productsStep, /Ajuste do pedido/)
  assert.match(cartSummary, /currency\(subtotal\)/)
  assert.match(cartSummary, /Subtotal dos produtos/)
  assert.match(cartSummary, /Revisar pedido/)
})

test('review step owns the full cart and financial checkout composition', async () => {
  const reviewStep = await read('../components/NewOrderReviewStep.jsx')
  const productsStep = await read('../components/NewOrderProductsStep.jsx')

  assert.match(reviewStep, /OrderCart/)
  assert.match(reviewStep, /OrderCheckoutSummary/)
  assert.match(reviewStep, /Voltar aos produtos/)
  assert.match(reviewStep, /customerSummary/)
  assert.match(reviewStep, /itemCount/)
  assert.doesNotMatch(productsStep, /import OrderCart|<OrderCart/)
  assert.doesNotMatch(productsStep, /OrderCheckoutSummary/)
})

test('step navigation preserves the single draft and focuses the active step', async () => {
  const page = await read('./NewOrder.jsx')

  assert.match(page, /const navigateStep = \(targetStep\) =>/)
  assert.match(page, /getFurthestReachedStep/)
  assert.match(page, /stepContentRef/)
  assert.match(page, /stepContentRef\.current\?\.focus\(\)/)
  assert.match(page, /tabIndex="-1"/)
  assert.doesNotMatch(page, /setItems\(\[\]\)[\s\S]{0,140}setCurrentStep/)
  assert.doesNotMatch(page, /setAdjustment\(emptyAdjustment\(\)\)[\s\S]{0,140}setCurrentStep/)
})
