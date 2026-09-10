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

test('new order starts on the context-appropriate step and customer step contains only attendance data', async () => {
  const page = await read('./NewOrder.jsx')
  const customerStep = await read('../components/NewOrderCustomerStep.jsx')

  assert.match(page, /initialTableId \? NEW_ORDER_STEPS\.PRODUCTS : NEW_ORDER_STEPS\.CUSTOMER/)
  assert.match(page, /useState\(initialStep\)/)
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

test('customer step exposes same-day scheduling controls and helper text', async () => {
  const source = await read('../components/NewOrderCustomerStep.jsx')
  assert.match(source, /Quando preparar\?/)
  assert.match(source, />Agora</)
  assert.match(source, />Agendado</)
  assert.match(source, /Horário desejado pelo cliente/)
  assert.match(source, /Esse horário é uma referência de atendimento\./)
  assert.doesNotMatch(source, /type="time"/)
  assert.match(source, /type="text"[\s\S]{0,220}inputMode="numeric"/)
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
  assert.match(reviewStep, /Agendado/)
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

test('wizard dirty state tracks the selected table and optional local client', async () => {
  const page = await read('./NewOrder.jsx')
  const flow = await read('../utils/newOrderStepFlow.js')

  assert.match(page, /createNewOrderDirtySnapshot\(\{[\s\S]*selectedTableId,[\s\S]*localClientId,/)
  assert.match(page, /isNewOrderDraftDirty\(\{[\s\S]*selectedTableId,[\s\S]*localClientId,/)
  assert.match(flow, /selectedTableId: String\(draft\.selectedTableId \?\? ''\)/)
  assert.match(flow, /localClientId: String\(draft\.localClientId \?\? ''\)/)
})
