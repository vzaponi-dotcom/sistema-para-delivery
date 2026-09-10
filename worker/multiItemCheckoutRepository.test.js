import test from 'node:test'
import assert from 'node:assert/strict'
import { createOrder, mapOrderItemRow, mapOrderRow } from './repositories.js'

class CheckoutDb {
  constructor() {
    this.clients = new Map([
      ['c1', { id: 'c1', business_id: 'amor-e-sabor', name: 'Maria', phone: '11999999999', address: '' }],
      ['other-client', { id: 'other-client', business_id: 'outro-negocio', name: 'Outro cliente', phone: '', address: '' }],
    ])
    this.products = new Map([
      ['p1', { id: 'p1', business_id: 'amor-e-sabor', category: 'Marmita', size: 'G', name: 'Marmita G', price_cents: 3200, active: 1 }],
      ['p2', { id: 'p2', business_id: 'amor-e-sabor', category: 'Bebida', size: 'Lata', name: 'Coca', price_cents: 800, active: 1 }],
    ])
    this.orders = new Map()
    this.items = new Map()
    this.payments = new Map()
    this.movements = new Map()
    this.tables = new Map([
      ['table-1', { id: 'table-1', business_id: 'amor-e-sabor', name: 'Mesa 4', is_active: 1 }],
      ['table-inactive', { id: 'table-inactive', business_id: 'amor-e-sabor', name: 'Mesa 5', is_active: 0 }],
      ['other-table', { id: 'other-table', business_id: 'outro-negocio', name: 'Mesa 6', is_active: 1 }],
    ])
    this.tableTabs = []
    this.tableTabCounters = new Map()
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
            if (sql.includes('UPDATE table_tab_counters')) {
              const [, businessId] = values
              const lastNumber = (db.tableTabCounters.get(businessId) ?? 0) + 1
              db.tableTabCounters.set(businessId, lastNumber)
              return { last_number: lastNumber }
            }
            if (sql.includes('FROM tables')) {
              const [tableId, businessId] = values
              const row = db.tables.get(tableId)
              return row?.business_id === businessId ? row : null
            }
            if (sql.includes('FROM table_tabs')) {
              const [businessId, tableId] = values
              return db.tableTabs.find((row) => row.business_id === businessId && row.table_id === tableId && row.status === 'open') ?? null
            }
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
      tableTabs: this.tableTabs.map((row) => ({ ...row })),
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
      this.tableTabs = snapshots.tableTabs
      throw error
    }
  }

  async _run(sql, values) {
    if (sql.includes('INSERT OR IGNORE INTO table_tab_counters')) {
      const [businessId] = values
      if (!this.tableTabCounters.has(businessId)) this.tableTabCounters.set(businessId, 0)
    } else if (sql.includes('INSERT OR IGNORE INTO table_tabs')) {
      const [id, businessId, tableId, tableIdentifier, tabNumber, openedAt, createdAt, updatedAt] = values
      const existing = this.tableTabs.find((row) => row.business_id === businessId && row.table_id === tableId && row.status === 'open')
      if (!existing) {
        this.tableTabs.push({
          id, business_id: businessId, table_id: tableId, table_identifier: tableIdentifier, tab_number: tabNumber, status: 'open', opened_at: openedAt,
          closed_at: null, created_at: createdAt, updated_at: updatedAt,
        })
      }
    } else if (sql.includes('INSERT INTO orders')) {
      const hasTableTab = values.length === 22
      const [id, businessId, clientId, clientName, customerIdentityType] = values
      const tableTabId = hasTableTab ? values[5] : null
      const offset = hasTableTab ? 1 : 0
      const type = values[5 + offset]
      const orderDate = values[6 + offset]
      const status = values[7 + offset]
      const scheduledFor = values[8 + offset]
      const isBackdated = values[9 + offset]
      const subtotal = values[10 + offset]
      const deliveryFee = values[11 + offset]
      const adjustmentType = values[12 + offset]
      const adjustmentMode = values[13 + offset]
      const adjustmentValue = values[14 + offset]
      const adjustmentAmount = values[15 + offset]
      const adjustmentReason = values[16 + offset]
      const total = values[17 + offset]
      const createdAt = values[18 + offset]
      const finishedAt = values[19 + offset]
      const idempotencyKey = values[20 + offset]
      if ([...this.orders.values()].some((row) => row.business_id === businessId && row.idempotency_key === idempotencyKey)) throw new Error('UNIQUE constraint failed')
      this.orders.set(id, {
        id, business_id: businessId, client_id: clientId, client_name_snapshot: clientName, customer_identity_type: customerIdentityType,
        table_tab_id: tableTabId, type, order_date: orderDate, status, scheduled_for: scheduledFor, is_backdated: isBackdated, subtotal_cents: subtotal, delivery_fee_cents: deliveryFee,
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

const tableInput = (tableId, idempotencyKey, clientId) => baseInput({
  clientId: null,
  customerIdentity: { type: 'table', tableId, ...(clientId ? { clientId } : {}) },
  type: 'Local',
  idempotencyKey,
  items: [{ productId: 'p1', quantity: 1, note: '' }],
  deliveryFeeCents: 0,
  adjustment: { type: 'none', mode: 'fixed', storedValue: 0, reason: '' },
  paymentMethod: null,
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

test('order mapping exposes scheduled metadata and backdated marker', () => {
  const order = mapOrderRow({
    id: 'o-scheduled', client_name_snapshot: 'Maria', type: 'Entrega', status: 'Em preparo', order_date: '2026-09-04',
    scheduled_for: '2026-09-04T15:00:00.000Z', is_backdated: 0, subtotal_cents: 1000, delivery_fee_cents: 0,
    adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0, adjustment_amount_cents: 0, total_cents: 1000,
    created_at: '2026-09-04T12:00:00.000Z', finished_at: null,
  })
  assert.equal(order.scheduledFor, '2026-09-04T15:00:00.000Z')
  assert.equal(order.isBackdated, false)
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

test('local orders without a client reuse the persistent table tab and its exact name snapshot', async () => {
  const db = new CheckoutDb()
  const now = new Date('2026-09-02T18:00:00.000Z')
  const first = await createOrder(db, 'amor-e-sabor', tableInput('table-1', 'tab-a-1'), now)
  const second = await createOrder(db, 'amor-e-sabor', tableInput('table-1', 'tab-a-2'), new Date('2026-09-02T18:01:00.000Z'))

  assert.equal(first.tableTabId, second.tableTabId)
  assert.equal(db.tableTabs.filter((tab) => tab.status === 'open').length, 1)
  assert.equal(db.tableTabs[0].table_id, 'table-1')
  assert.equal(db.tableTabs[0].table_identifier, 'Mesa 4')
  assert.equal(db.tableTabs[0].tab_number, 1)
  assert.equal(first.clientId, null)
  assert.equal(first.client, 'Mesa 4')
  assert.equal(first.customerIdentityType, 'table')
})

test('local order persists an optional same-business client snapshot', async () => {
  const db = new CheckoutDb()
  const order = await createOrder(
    db,
    'amor-e-sabor',
    tableInput('table-1', 'table-client', 'c1'),
    new Date('2026-09-02T18:00:00.000Z'),
  )

  assert.equal(order.clientId, 'c1')
  assert.equal(order.client, 'Maria')
  assert.equal(order.customerIdentityType, 'table')
  assert.equal(order.tableTabId, db.tableTabs[0].id)
  assert.equal(db.tableTabs[0].tab_number, 1)
})

test('local order rejects an optional client from another business', async () => {
  const db = new CheckoutDb()

  await assert.rejects(
    () => createOrder(db, 'amor-e-sabor', tableInput('table-1', 'cross-client', 'other-client'), new Date('2026-09-02T18:00:00.000Z')),
    (error) => error.status === 404 && error.code === 'CLIENT_NOT_FOUND',
  )
  assert.equal(db.orders.size, 0)
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
