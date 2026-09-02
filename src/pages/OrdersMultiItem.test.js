import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('orders operation renders all items and exposes complete detail', () => {
  const orders = source('./Orders.jsx')
  const detail = source('../components/OrderDetail.jsx')

  assert.match(orders, /getOrderItems\(order\)/)
  assert.match(orders, /order-items-list/)
  assert.match(orders, /item\.note/)
  assert.match(orders, /Ver detalhes/)
  assert.match(orders, /getOrderItemsSummary\(order\)/)
  assert.match(detail, /Taxa de entrega/)
  assert.match(detail, /Forma de pagamento/)
  assert.match(detail, /Subtotal/)
  assert.match(detail, /Total/)
})

test('app order search uses the complete multi-item searchable text', () => {
  const app = source('../App.jsx')
  assert.match(app, /getOrderItemsSearchText\(order\)/)
})
