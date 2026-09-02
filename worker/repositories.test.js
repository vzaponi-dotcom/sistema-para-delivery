import test from 'node:test'
import assert from 'node:assert/strict'
import { loadBootstrap, mapMovementRow, mapOrderItemRow, mapOrderRow, mapProductRow } from './repositories.js'

test('product row maps integer cents to current frontend price number', () => {
  assert.deepEqual(mapProductRow({ id: 'p1', category: 'Bebida', size: '350ml', name: 'Coca', price_cents: 850 }), {
    id: 'p1', category: 'Bebida', size: '350ml', name: 'Coca', price: 8.5,
  })
})

test('order item snapshots map prices and product identity', () => {
  assert.deepEqual(mapOrderItemRow({
    id: 'i1', product_id: 'p1', name_snapshot: 'Coca', category_snapshot: 'Bebida', size_snapshot: '350ml',
    quantity: 2, catalog_price_cents: 850, unit_price_cents: 800, price_reason: 'Promoção',
  }), {
    id: 'i1', productId: 'p1', name: 'Coca', category: 'Bebida', size: '350ml', quantity: 2,
    catalogPrice: 8.5, unitPrice: 8, priceReason: 'Promoção',
  })
})

test('order row exposes current payment fields and first-item compatibility fields', () => {
  const item = { id: 'i1', productId: 'p1', name: 'Marmita Média', category: 'Marmita', size: 'M', quantity: 2, catalogPrice: 21, unitPrice: 21, priceReason: '' }
  const order = mapOrderRow({
    id: 'o1', client_id: 'c1', client_name_snapshot: 'Maria', type: 'Entrega', status: 'Em preparo',
    order_date: '2026-09-01', subtotal_cents: 4200, total_cents: 4200, created_at: '2026-09-01T20:00:00.000Z',
    finished_at: null, payment_id: null, payment_method: null, paid_at: null, paid_amount_cents: null,
    adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0, adjustment_amount_cents: 0, adjustment_reason: '',
  }, [item])
  assert.equal(order.paymentStatus, 'Pendente')
  assert.equal(order.total, 42)
  assert.equal(order.productName, 'Marmita Média')
  assert.equal(order.quantity, 2)
  assert.deepEqual(order.items, [item])
})

test('paid order and movement map cents to current frontend numbers', () => {
  const order = mapOrderRow({
    id: 'o1', client_name_snapshot: 'Maria', type: 'Entrega', status: 'Finalizado', order_date: '2026-09-01',
    total_cents: 4200, subtotal_cents: 4200, created_at: '2026-09-01T20:00:00.000Z', finished_at: null,
    payment_id: 'pay1', payment_method: 'Pix', paid_at: '2026-09-01T20:05:00.000Z', paid_amount_cents: 4200,
  })
  assert.equal(order.paymentStatus, 'Pago')
  assert.equal(order.paidAmount, 42)
  assert.equal(order.paymentMethod, 'Pix')

  assert.equal(mapMovementRow({
    id: 'm1', type: 'entrada', category: 'Vendas', description: 'Pedido', value_cents: 4200,
    source: 'order-payment', order_id: 'o1', payment_id: 'pay1', movement_date: '2026-09-01', created_at: '2026-09-01T20:05:00.000Z',
  }).value, 42)
})

class BootstrapDb {
  constructor() {
    this.calls = []
  }

  prepare(sql) {
    const db = this
    return {
      bind(...values) {
        db.calls.push({ sql, values })
        return {
          async first() {
            if (sql.includes('FROM businesses')) return { id: 'amor-e-sabor', name: 'Amor & Sabor' }
            return null
          },
          async all() {
            if (sql.includes('FROM clients')) return { results: [{ id: 'c1', name: 'Maria', phone: '11', address: 'Centro' }] }
            if (sql.includes('FROM products')) return { results: [{ id: 'p1', category: 'Bebida', size: '350ml', name: 'Coca', price_cents: 850 }] }
            if (sql.includes('FROM orders')) return { results: [{
              id: 'o1', client_id: 'c1', client_name_snapshot: 'Maria', type: 'Entrega', order_date: '2026-09-01', status: 'Em preparo',
              subtotal_cents: 850, adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0,
              adjustment_amount_cents: 0, adjustment_reason: '', total_cents: 850, created_at: '2026-09-01T20:00:00.000Z', finished_at: null,
              payment_id: null, payment_method: null, paid_at: null, paid_amount_cents: null,
            }] }
            if (sql.includes('FROM order_items')) return { results: [{
              id: 'i1', order_id: 'o1', product_id: 'p1', name_snapshot: 'Coca', category_snapshot: 'Bebida', size_snapshot: '350ml',
              quantity: 1, catalog_price_cents: 850, unit_price_cents: 850, price_reason: '', created_at: '2026-09-01T20:00:00.000Z',
            }] }
            if (sql.includes('FROM movements')) return { results: [] }
            return { results: [] }
          },
        }
      },
    }
  }
}

test('loadBootstrap scopes every business-owned query and attaches order items', async () => {
  const db = new BootstrapDb()
  const result = await loadBootstrap(db, 'amor-e-sabor')
  assert.deepEqual(result.business, { id: 'amor-e-sabor', name: 'Amor & Sabor' })
  assert.equal(result.clients[0].name, 'Maria')
  assert.equal(result.products[0].price, 8.5)
  assert.equal(result.orders[0].items[0].name, 'Coca')
  assert.deepEqual(result.movements, [])

  for (const call of db.calls) {
    assert.equal(call.values[0], 'amor-e-sabor')
    if (!call.sql.includes('FROM businesses')) assert.match(call.sql, /business_id/)
  }
})
