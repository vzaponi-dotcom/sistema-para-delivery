import test from 'node:test'
import assert from 'node:assert/strict'
import { createOrder, mapOrderItemRow, mapOrderRow } from './repositories.js'

class CheckoutDb {
  constructor() {
    this.clients = new Map([['c1', { id: 'c1', business_id: 'amor-e-sabor', name: 'Maria' }]])
    this.products = new Map([
      ['p1', { id: 'p1', business_id: 'amor-e-sabor', category: 'Marmita', size: 'G', name: 'Marmita G', price_cents: 3200, active: 1 }],
      ['p2', { id: 'p2', business_id: 'amor-e-sabor', category: 'Bebida', size: 'Lata', name: 'Coca', price_cents: 800, active: 1 }],
    ])
    this.orders = new Map()
    this.items = new Map()
    this.payments = new Map()
    this.movements = new Map()
    this.failNextBatch = false
  }

  prepare(sql) {
    const db = this
    return {
      bind(...values) {
        return {
          sql,
          values,
          async first() {
            if (sql.includes('idempotency_key') && !sql.includes('INSERT')) {
              const [businessId, key] = values
              return [...db.orders.values()].find((row) => row.business_id === businessId && row.idempotency_key === key) ?? null
            }
            if (sql.includes('FROM clients')) {
              const [id, businessId] = values
              const row = db.clients.get(id)
              return row?.business_id === businessId ? row : null
            }
            if (sql.includes('FROM products')) {
              const [id, businessId] = values
              const row = db.products.get(id)
              return row?.business_id === businessId && row.active === 1 ? row : null
            }
            if (sql.includes('FROM orders') && sql.includes('payment_id')) {
              const [id, businessId] = values
              const row = db.orders.get(id)
              if (!row || row.business_id !== businessId) return null
              const payment = [...db.payments.values()].find((entry) => entry.order_id === id && entry.business_id === businessId)
              return {
                ...row,
                payment_id: payment?.id ?? null,
                payment_method: payment?.method ?? null,
                paid_at: payment?.paid_at ?? null,
                paid_amount_cents: payment?.amount_cents ?? null,
              }
            }
            if (sql.includes('FROM payments')) {
              const [orderId, businessId] = values
              return [...db.payments.values()].find((entry) => entry.order_id === orderId && entry.business_id === businessId) ?? null
            }
            return null
          },
          async all() {
            if (sql.includes('FROM order_items')) {
              const [orderId, businessId] = values
              return { results: [...db.items.values()].filter((row) => row.order_id === orderId && row.business_id === businessId) }
            }
            return { results: [] }
          },
          async run() { return db._run(sql, values) },
        }
      },
    }
  }

  async batch(statements) {
    const snapshots = {
      orders: new Map(this.orders), items: new Map(this.items),
      payments: new Map(this.payments), movements: new Map(this.movements),
    }
    try {
      if (this.failNextBatch) {
        this.failNextBatch = false
        throw new Error('forced batch failure')
      }
      return await Promise.all(statements.map((statement) => statement.run()))
    } catch (error) {
      this.orders = snapshots.orders
      this.items = snapshots.items
      this.payments = snapshots.payments
      this.movements = snapshots.movements
      throw error
    }
  }

  async _run(sql, values) {
    if (sql.includes('INSERT INTO orders')) {
      const [id, businessId, clientId, clientName, type, orderDate, status, subtotal, deliveryFee, adjustmentType, adjustmentMode, adjustmentValue, adjustmentAmount, adjustmentReason, total, createdAt, finishedAt, idempotencyKey] = values
      if ([...this.orders.values()].some((row) => row.business_id === businessId && row.idempotency_key === idempotencyKey)) throw new Error('UNIQUE constraint failed')
      this.orders.set(id, {
        id, business_id: businessId, client_id: clientId, client_name_snapshot: clientName, type,
        order_date: orderDate, status, subtotal_cents: subtotal, delivery_fee_cents: deliveryFee,
        adjustment_type: adjustmentType, adjustment_mode: adjustmentMode, adjustment_value: adjustmentValue,
        adjustment_amount_cents: adjustmentAmount, adjustment_reason: adjustmentReason, total_cents: total,
        created_at: createdAt, finished_at: finishedAt, idempotency_key: idempotencyKey,
      })
    } else if (sql.includes('INSERT INTO order_items')) {
      const [id, businessId, orderId, productId, name, category, size, quantity, catalogPrice, unitPrice, priceReason, note, createdAt] = values
      this.items.set(id, {
        id, business_id: businessId, order_id: orderId, product_id: productId,
        name_snapshot: name, category_snapshot: category, size_snapshot: size, quantity,
        catalog_price_cents: catalogPrice, unit_price_cents: unitPrice, price_reason: priceReason,
        note, created_at: createdAt,
      })
    } else if (sql.includes('INSERT INTO payments')) {
      const [id, businessId, orderId, amount, method, paidAt, createdAt] = values
      this.payments.set(id, { id, business_id: businessId, order_id: orderId, amount_cents: amount, method, paid_at: paidAt, created_at: createdAt })
    } else if (sql.includes('INSERT INTO movements')) {
      const [id, businessId, type, category, description, value, source, orderId, paymentId, movementDate, createdAt] = values
      this.movements.set(id, { id, business_id: businessId, type, category, description, value_cents: value, source, order_id: orderId, payment_id: paymentId, movement_date: movementDate, created_at: createdAt })
    }
    return { success: true }
  }
}

const baseInput = (overrides = {}) => ({
  clientId: 'c1',
  type: 'Entrega',
  orderDate: '2026-09-01',
  idempotencyKey: 'multi-1',
  items: [
    { productId: 'p1', quantity: 2, note: 'sem cebola' },
    { productId: 'p2', quantity: 1, note: '' },
  ],
  deliveryFeeCents: 800,
  adjustment: { type: 'discount', mode: 'percentage', storedValue: 1000, reason: '' },
  paymentMethod: null,
  ...overrides,
})

test('order/item mapping exposes delivery fee, note and friendly percentage', () => {
  const item = mapOrderItemRow({ id: 'i1', product_id: 'p1', name_snapshot: 'Marmita G', category_snapshot: 'Marmita', size_snapshot: 'G', quantity: 1, catalog_price_cents: 3200, unit_price_cents: 3200, price_reason: '', note: 'sem cebola' })
  const order = mapOrderRow({
    id: 'o1', client_name_snapshot: 'Maria', type: 'Entrega', status: 'Em preparo', order_date: '2026-09-01',
    subtotal_cents: 3200, delivery_fee_cents: 800, adjustment_type: 'discount', adjustment_mode: 'percentage',
    adjustment_value: 750, adjustment_amount_cents: 240, adjustment_reason: 'fidelidade', total_cents: 3760,
    created_at: '2026-09-01T20:00:00.000Z', finished_at: null,
  }, [item])
  assert.equal(item.note, 'sem cebola')
  assert.equal(order.deliveryFee, 8)
  assert.equal(order.adjustment.value, 7.5)
})

test('createOrder uses server product prices for several items, fee and adjustment', async () => {
  const db = new CheckoutDb()
  const order = await createOrder(db, 'amor-e-sabor', baseInput(), new Date('2026-09-01T20:00:00.000Z'))
  assert.equal(order.items.length, 2)
  assert.equal(order.items[0].note, 'sem cebola')
  assert.equal(order.subtotal, 72)
  assert.equal(order.deliveryFee, 8)
  assert.equal(order.adjustment.amount, 7.2)
  assert.equal(order.total, 72.8)
  assert.equal(order.paymentStatus, 'Pendente')
})

test('paid retry creates one order, payment and movement and stays Em preparo', async () => {
  const db = new CheckoutDb()
  const payload = baseInput({
    idempotencyKey: 'paid-1',
    items: [{ productId: 'p1', quantity: 1, note: '' }],
    deliveryFeeCents: 0,
    adjustment: { type: 'none', mode: 'fixed', storedValue: 0, reason: '' },
    paymentMethod: 'Pix',
  })
  const first = await createOrder(db, 'amor-e-sabor', payload, new Date('2026-09-01T20:00:00.000Z'))
  const second = await createOrder(db, 'amor-e-sabor', payload, new Date('2026-09-01T20:01:00.000Z'))
  assert.equal(first.id, second.id)
  assert.equal(first.status, 'Em preparo')
  assert.equal(first.paymentStatus, 'Pago')
  assert.equal(db.orders.size, 1)
  assert.equal(db.payments.size, 1)
  assert.equal(db.movements.size, 1)
})

test('failed paid checkout rolls back order items payment and movement together', async () => {
  const db = new CheckoutDb()
  db.failNextBatch = true
  await assert.rejects(() => createOrder(db, 'amor-e-sabor', baseInput({ paymentMethod: 'Pix' }), new Date('2026-09-01T20:00:00.000Z')))
  assert.equal(db.orders.size, 0)
  assert.equal(db.items.size, 0)
  assert.equal(db.payments.size, 0)
  assert.equal(db.movements.size, 0)
})
