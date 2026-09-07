import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ORDER_PRINT_DOCUMENT_VERSION,
  ORDER_PRINT_THANK_YOU,
  createOrderPrintDocument,
  createTestPrintDocument,
  formatPrintMoneyCents,
  getFriendlyOrderNumber,
} from './orderPrintDocument.js'

const orderInput = (overrides = {}) => ({
  businessName: 'Amor & Sabor',
  orderId: 'order-0184',
  orderDate: '2026-09-03',
  createdAt: '2026-09-03T23:31:00.000Z',
  type: 'Entrega',
  customer: { name: 'João Silva', phone: '(11) 99876-5432', address: 'Rua das Flores, 123' },
  items: [
    { name: 'X-BURGER', presentation: '', quantity: 2, note: 'Sem cebola + Bacon', unitPriceCents: 3000 },
    { name: 'BATATA', presentation: 'G', quantity: 1, note: 'Cheddar e bacon', unitPriceCents: 1200 },
  ],
  subtotalCents: 7200,
  deliveryFeeCents: 800,
  adjustment: { type: 'discount', amountCents: 0, reason: '' },
  totalCents: 8000,
  payment: { status: 'Pago', method: 'Pix' },
  ...overrides,
})

test('canonical order print document keeps approved customer-safe ticket data in cents', () => {
  const document = createOrderPrintDocument(orderInput())

  assert.equal(ORDER_PRINT_DOCUMENT_VERSION, 1)
  assert.equal(document.version, 1)
  assert.equal(document.type, 'order')
  assert.equal(document.business.name, 'Amor & Sabor')
  assert.equal(document.order.id, 'order-0184')
  assert.equal(document.order.number, '0184')
  assert.equal(document.order.type, 'Entrega')
  assert.deepEqual(document.customer, {
    name: 'João Silva',
    phone: '(11) 99876-5432',
    address: 'Rua das Flores, 123',
  })
  assert.equal(document.items[0].quantity, 2)
  assert.equal(document.items[0].unitPriceCents, 3000)
  assert.equal(document.items[0].lineTotalCents, 6000)
  assert.equal(document.items[0].note, 'Sem cebola + Bacon')
  assert.equal(document.financial.subtotalCents, 7200)
  assert.equal(document.financial.deliveryFeeCents, 800)
  assert.equal(document.financial.totalCents, 8000)
  assert.deepEqual(document.payment, { status: 'Pago', method: 'Pix' })
  assert.equal(document.message, 'Obrigado pela compra! Agradecemos a preferência.')
  assert.equal(document.message, ORDER_PRINT_THANK_YOU)
})

test('canonical document normalizes optional values without inventing payment or contact data', () => {
  const document = createOrderPrintDocument(orderInput({
    customer: { name: 'Mesa A-01' },
    payment: null,
    deliveryFeeCents: undefined,
    adjustment: undefined,
    items: [{ name: 'Marmita', quantity: 1, unitPriceCents: 3200 }],
    totalCents: 3200,
  }))

  assert.deepEqual(document.customer, { name: 'Mesa A-01', phone: '', address: '' })
  assert.deepEqual(document.payment, { status: 'Pendente', method: '' })
  assert.equal(document.financial.deliveryFeeCents, 0)
  assert.deepEqual(document.financial.adjustment, { type: 'none', amountCents: 0, reason: '' })
  assert.equal(document.items[0].presentation, '')
  assert.equal(document.items[0].note, '')
})

test('local order documents prioritize the persisted table snapshot and append an optional client', () => {
  const withoutClient = createOrderPrintDocument(orderInput({
    type: 'Local',
    customerIdentityType: 'table',
    tableIdentifier: 'Mesa 4',
    customer: { name: 'Mesa 4' },
  }))
  const withClient = createOrderPrintDocument(orderInput({
    type: 'Local',
    customerIdentityType: 'table',
    tableIdentifier: 'Mesa 4',
    hasOptionalClient: true,
    customer: { name: 'Hugo' },
  }))
  const legacyGuest = createOrderPrintDocument(orderInput({
    type: 'Local',
    customerIdentityType: 'guest_name',
    customer: { name: 'Nome legado' },
  }))

  assert.equal(withoutClient.customer.name, 'Mesa 4')
  assert.equal(withClient.customer.name, 'Mesa 4 · Hugo')
  assert.equal(legacyGuest.customer.name, 'Nome legado')
})

test('money and friendly order helpers use Brazilian ticket formatting', () => {
  assert.equal(formatPrintMoneyCents(8750), 'R$ 87,50')
  assert.equal(getFriendlyOrderNumber('order-0184'), '0184')
})

test('test print document is explicit and never fabricates an order', () => {
  const document = createTestPrintDocument({
    businessName: 'Amor & Sabor',
    createdAt: '2026-09-03T23:31:00.000Z',
  })

  assert.equal(document.version, 1)
  assert.equal(document.type, 'test')
  assert.equal(document.business.name, 'Amor & Sabor')
  assert.deepEqual(document.test, {
    title: 'TESTE DE IMPRESSÃO',
    message: 'Impressora configurada com sucesso.',
    createdAt: '2026-09-03T23:31:00.000Z',
  })
  assert.equal('order' in document, false)
  assert.equal('customer' in document, false)
  assert.equal('financial' in document, false)
})
