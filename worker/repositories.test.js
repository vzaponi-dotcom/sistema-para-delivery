import test from 'node:test'
import assert from 'node:assert/strict'
import { mapMovementRow } from './financeRepository.js'
import { createClient, createProduct, deleteClient, deleteProduct, loadBootstrap, mapOrderItemRow, mapOrderRow, mapProductRow, updateClient, updateProduct } from './repositories.js'

test('product row maps integer cents to current frontend price number', () => {
  assert.deepEqual(mapProductRow({ id: 'p1', category: 'Bebida', size: '350ml', name: 'Coca', price_cents: 850 }), {
    id: 'p1', category: 'Bebida', size: '350ml', name: 'Coca', price: 8.5,
  })
})

test('order item snapshots map prices and product identity', () => {
  assert.deepEqual(mapOrderItemRow({
    id: 'i1', product_id: 'p1', name_snapshot: 'Coca', category_snapshot: 'Bebida', size_snapshot: '350ml',
    quantity: 2, catalog_price_cents: 850, unit_price_cents: 800, price_reason: 'Promoção', note: '',
  }), {
    id: 'i1', productId: 'p1', name: 'Coca', category: 'Bebida', size: '350ml', quantity: 2,
    catalogPrice: 8.5, unitPrice: 8, priceReason: 'Promoção', note: '',
  })
})

test('order row exposes current payment fields and first-item compatibility fields', () => {
  const item = { id: 'i1', productId: 'p1', name: 'Marmita Média', category: 'Marmita', size: 'M', quantity: 2, catalogPrice: 21, unitPrice: 21, priceReason: '', note: '' }
  const order = mapOrderRow({
    id: 'o1', client_id: 'c1', client_name_snapshot: 'Maria', type: 'Entrega', status: 'Em preparo',
    order_date: '2026-09-01', subtotal_cents: 4200, delivery_fee_cents: 0, total_cents: 4200, created_at: '2026-09-01T20:00:00.000Z',
    finished_at: null, payment_id: null, payment_method: null, paid_at: null, paid_amount_cents: null,
    adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0, adjustment_amount_cents: 0, adjustment_reason: '',
  }, [item])
  assert.equal(order.paymentStatus, 'Pendente')
  assert.equal(order.total, 42)
  assert.equal(order.deliveryFee, 0)
  assert.equal(order.productName, 'Marmita Média')
  assert.equal(order.quantity, 2)
  assert.deepEqual(order.items, [item])
})

test('paid order and movement map cents to current frontend numbers', () => {
  const order = mapOrderRow({
    id: 'o1', client_name_snapshot: 'Maria', type: 'Entrega', status: 'Finalizado', order_date: '2026-09-01',
    total_cents: 4200, subtotal_cents: 4200, delivery_fee_cents: 0, created_at: '2026-09-01T20:00:00.000Z', finished_at: null,
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
            if (sql.includes('FROM table_tabs')) return { results: [{ id: 'tab-1', table_identifier: '04', status: 'open', opened_at: '2026-09-02T18:00:00.000Z', closed_at: null }] }
            if (sql.includes('FROM orders')) return { results: [{
              id: 'o1', client_id: 'c1', client_name_snapshot: 'Maria', table_tab_id: null, type: 'Entrega', order_date: '2026-09-01', status: 'Em preparo',
              subtotal_cents: 850, delivery_fee_cents: 0, adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0,
              adjustment_amount_cents: 0, adjustment_reason: '', total_cents: 850, created_at: '2026-09-01T20:00:00.000Z', finished_at: null,
              payment_id: null, payment_method: null, paid_at: null, paid_amount_cents: null,
            }] }
            if (sql.includes('FROM order_items')) return { results: [{
              id: 'i1', order_id: 'o1', product_id: 'p1', name_snapshot: 'Coca', category_snapshot: 'Bebida', size_snapshot: '350ml',
              quantity: 1, catalog_price_cents: 850, unit_price_cents: 850, price_reason: '', note: '', created_at: '2026-09-01T20:00:00.000Z',
            }] }
            if (sql.includes('FROM movements')) return { results: [] }
            return { results: [] }
          },
        }
      },
    }
  }
}

test('loadBootstrap scopes every business-owned query and attaches order items and table tabs', async () => {
  const db = new BootstrapDb()
  const result = await loadBootstrap(db, 'amor-e-sabor')
  assert.deepEqual(result.business, { id: 'amor-e-sabor', name: 'Amor & Sabor' })
  assert.equal(result.clients[0].name, 'Maria')
  assert.equal(result.products[0].price, 8.5)
  assert.equal(result.orders[0].items[0].name, 'Coca')
  assert.equal(result.orders[0].items[0].note, '')
  assert.deepEqual(result.tableTabs, [{
    id: 'tab-1', tableIdentifier: '04', status: 'open',
    openedAt: '2026-09-02T18:00:00.000Z', closedAt: null,
  }])
  assert.deepEqual(result.movements, [])

  for (const call of db.calls) {
    assert.equal(call.values[0], 'amor-e-sabor')
    if (!call.sql.includes('FROM businesses')) assert.match(call.sql, /business_id/)
  }
})

class CrudDb {
  constructor() {
    this.clients = new Map()
    this.products = new Map()
    this.calls = []
  }

  prepare(sql) {
    const db = this
    return {
      bind(...values) {
        db.calls.push({ sql, values })
        return {
          async first() {
            if (sql.includes('FROM clients')) {
              const [id, businessId] = values
              const row = db.clients.get(id)
              return row?.business_id === businessId ? row : null
            }
            if (sql.includes('FROM products')) {
              const [id, businessId] = values
              const row = db.products.get(id)
              return row?.business_id === businessId ? row : null
            }
            return null
          },
          async run() {
            if (sql.includes('INSERT INTO clients')) {
              const [id, businessId, name, phone, address, createdAt, updatedAt] = values
              db.clients.set(id, { id, business_id: businessId, name, phone, address, created_at: createdAt, updated_at: updatedAt })
            } else if (sql.includes('UPDATE clients SET')) {
              const [name, phone, address, updatedAt, id, businessId] = values
              const row = db.clients.get(id)
              if (row?.business_id === businessId) Object.assign(row, { name, phone, address, updated_at: updatedAt })
            } else if (sql.includes('DELETE FROM clients')) {
              const [id, businessId] = values
              const row = db.clients.get(id)
              if (row?.business_id === businessId) db.clients.delete(id)
            } else if (sql.includes('INSERT INTO products')) {
              const [id, businessId, category, size, name, priceCents, createdAt, updatedAt] = values
              db.products.set(id, { id, business_id: businessId, category, size, name, price_cents: priceCents, active: 1, created_at: createdAt, updated_at: updatedAt })
            } else if (sql.includes('UPDATE products SET category')) {
              const [category, size, name, priceCents, updatedAt, id, businessId] = values
              const row = db.products.get(id)
              if (row?.business_id === businessId) Object.assign(row, { category, size, name, price_cents: priceCents, updated_at: updatedAt })
            } else if (sql.includes('UPDATE products SET active = 0')) {
              const [updatedAt, id, businessId] = values
              const row = db.products.get(id)
              if (row?.business_id === businessId) Object.assign(row, { active: 0, updated_at: updatedAt })
            }
            return { success: true }
          },
        }
      },
    }
  }
}

test('client CRUD scopes lookup/update/delete by business id', async () => {
  const db = new CrudDb()
  const now = new Date('2026-09-01T20:00:00.000Z')
  const client = await createClient(db, 'amor-e-sabor', { name: 'Maria', phone: '11', address: 'Centro' }, now)
  assert.equal(client.name, 'Maria')

  const other = { ...db.clients.get(client.id), business_id: 'outra-empresa' }
  db.clients.set('c-other', other)
  assert.equal(await updateClient(db, 'amor-e-sabor', 'c-other', { name: 'X', phone: '', address: '' }, now), null)

  const updated = await updateClient(db, 'amor-e-sabor', client.id, { name: 'Maria Silva', phone: '22', address: 'Bairro' }, now)
  assert.equal(updated.name, 'Maria Silva')
  assert.equal(await deleteClient(db, 'amor-e-sabor', client.id), true)
  assert.equal(await deleteClient(db, 'amor-e-sabor', client.id), false)

  const writeCalls = db.calls.filter(({ sql }) => /UPDATE clients|DELETE FROM clients/.test(sql))
  for (const call of writeCalls) assert.match(call.sql, /business_id = \?/)
})

test('product delete is soft and all product writes are business scoped', async () => {
  const db = new CrudDb()
  const now = new Date('2026-09-01T20:00:00.000Z')
  const product = await createProduct(db, 'amor-e-sabor', { category: 'Bebida', size: '350ml', name: 'Coca', priceCents: 850 }, now)
  assert.equal(product.price, 8.5)

  const updated = await updateProduct(db, 'amor-e-sabor', product.id, { category: 'Bebida', size: 'Lata', name: 'Coca Cola', priceCents: 900 }, now)
  assert.equal(updated.price, 9)
  assert.equal(await deleteProduct(db, 'amor-e-sabor', product.id, now), true)
  assert.equal(db.products.get(product.id).active, 0)

  const writes = db.calls.filter(({ sql }) => /UPDATE products/.test(sql))
  for (const call of writes) assert.match(call.sql, /business_id = \?/)
})
