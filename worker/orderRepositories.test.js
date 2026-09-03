import test from 'node:test'
import assert from 'node:assert/strict'
import { createMovement, createOrder, registerOrderPayment, updateOrderStatus } from './repositories.js'

class OrderDb {
  constructor() {
    this.clients = new Map([['c1', { id: 'c1', business_id: 'amor-e-sabor', name: 'Maria' }]])
    this.products = new Map([['p1', { id: 'p1', business_id: 'amor-e-sabor', category: 'Marmita', size: 'P', name: 'Marmita Pequena', price_cents: 3200, active: 1 }]])
    this.orders = new Map()
    this.items = new Map()
    this.payments = new Map()
    this.movements = new Map()
    this.tableTabs = new Map()
    this.batchCalls = []
  }

  prepare(sql) {
    const db = this
    return {
      bind(...values) {
        return {
          sql, values,
          async first() {
            if (sql.includes('COUNT(*) AS count')) {
              const [businessId, tableTabId] = values
              const count = [...db.orders.values()].filter((order) => order.business_id === businessId && order.table_tab_id === tableTabId && order.status !== 'Cancelado' && ![...db.payments.values()].some((payment) => payment.business_id === businessId && payment.order_id === order.id)).length
              return { count }
            }
            if (sql.includes('FROM table_tabs')) {
              const [id, businessId] = values
              const row = db.tableTabs.get(id)
              return row?.business_id === businessId ? row : null
            }
            if (sql.includes('FROM movements')) {
              const [businessId, orderId, source] = values
              return [...db.movements.values()].find((entry) => entry.business_id === businessId && entry.order_id === orderId && entry.source === source) ?? null
            }
            if (sql.includes('FROM clients')) { const [id, businessId] = values; const row = db.clients.get(id); return row?.business_id === businessId ? row : null }
            if (sql.includes('FROM products')) { const [id, businessId] = values; const row = db.products.get(id); return row?.business_id === businessId && row.active === 1 ? row : null }
            if (sql.includes('idempotency_key')) { const [businessId, key] = values; return [...db.orders.values()].find((row) => row.business_id === businessId && row.idempotency_key === key) ?? null }
            if (sql.includes('FROM orders') && sql.includes('payment_id')) {
              const [id, businessId] = values; const row = db.orders.get(id); if (!row || row.business_id !== businessId) return null
              const payment = [...db.payments.values()].find((entry) => entry.order_id === id && entry.business_id === businessId)
              return { ...row, payment_id: payment?.id ?? null, payment_method: payment?.method ?? null, paid_at: payment?.paid_at ?? null, paid_amount_cents: payment?.amount_cents ?? null }
            }
            if (sql.includes('FROM orders')) { const [id, businessId] = values; const row = db.orders.get(id); return row?.business_id === businessId ? row : null }
            if (sql.includes('FROM payments')) { const [orderId, businessId] = values; return [...db.payments.values()].find((entry) => entry.order_id === orderId && entry.business_id === businessId) ?? null }
            return null
          },
          async all() {
            if (sql.includes('FROM order_items')) { const [orderId, businessId] = values; return { results: [...db.items.values()].filter((row) => row.order_id === orderId && row.business_id === businessId) } }
            return { results: [] }
          },
          async run() { return db._run(sql, values) },
        }
      },
    }
  }

  async batch(statements) {
    this.batchCalls.push(statements)
    const snapshots = { orders: new Map(this.orders), items: new Map(this.items), payments: new Map(this.payments), movements: new Map(this.movements), tableTabs: new Map([...this.tableTabs].map(([id, tab]) => [id, { ...tab }])) }
    try { return await Promise.all(statements.map((statement) => statement.run())) } catch (error) { this.orders = snapshots.orders; this.items = snapshots.items; this.payments = snapshots.payments; this.movements = snapshots.movements; this.tableTabs = snapshots.tableTabs; throw error }
  }

  async _run(sql, values) {
    if (sql.includes('INSERT INTO orders')) {
      const [id, businessId, clientId, clientName, customerIdentityType, tableTabId, type, orderDate, status, subtotal, deliveryFee, adjustmentType, adjustmentMode, adjustmentValue, adjustmentAmount, adjustmentReason, total, createdAt, finishedAt, idempotencyKey] = values
      if ([...this.orders.values()].some((row) => row.business_id === businessId && row.idempotency_key === idempotencyKey)) throw new Error('UNIQUE constraint failed')
      this.orders.set(id, { id, business_id: businessId, client_id: clientId, client_name_snapshot: clientName, customer_identity_type: customerIdentityType, table_tab_id: tableTabId, type, order_date: orderDate, status, subtotal_cents: subtotal, delivery_fee_cents: deliveryFee, adjustment_type: adjustmentType, adjustment_mode: adjustmentMode, adjustment_value: adjustmentValue, adjustment_amount_cents: adjustmentAmount, adjustment_reason: adjustmentReason, total_cents: total, created_at: createdAt, finished_at: finishedAt, idempotency_key: idempotencyKey })
    } else if (sql.includes('INSERT INTO order_items')) {
      const [id, businessId, orderId, productId, name, category, size, quantity, catalogPrice, unitPrice, priceReason, note, createdAt] = values
      this.items.set(id, { id, business_id: businessId, order_id: orderId, product_id: productId, name_snapshot: name, category_snapshot: category, size_snapshot: size, quantity, catalog_price_cents: catalogPrice, unit_price_cents: unitPrice, price_reason: priceReason, note, created_at: createdAt })
    } else if (sql.includes('UPDATE orders SET status')) {
      const [finishedAt, id, businessId] = values; const row = this.orders.get(id); if (row?.business_id === businessId) Object.assign(row, { status: 'Finalizado', finished_at: row.finished_at || finishedAt })
    } else if (sql.includes('INSERT INTO payments')) {
      const [id, businessId, orderId, amount, method, paidAt, createdAt] = values; if ([...this.payments.values()].some((row) => row.order_id === orderId)) throw new Error('UNIQUE constraint failed'); this.payments.set(id, { id, business_id: businessId, order_id: orderId, amount_cents: amount, method, paid_at: paidAt, created_at: createdAt })
    } else if (sql.includes('INSERT INTO movements')) {
      const [id, businessId, type, category, description, value, source, orderId, paymentId, movementDate, createdAt] = values; this.movements.set(id, { id, business_id: businessId, type, category, description, value_cents: value, source, order_id: orderId, payment_id: paymentId, movement_date: movementDate, created_at: createdAt })
    } else if (sql.includes('UPDATE table_tabs SET status')) {
      const [closedAt, updatedAt, id, businessId] = values
      const tab = this.tableTabs.get(id)
      if (tab?.business_id === businessId && tab.status === 'open') Object.assign(tab, { status: 'closed', closed_at: tab.closed_at || closedAt, updated_at: updatedAt })
    }
    return { success: true }
  }
}

test('createOrder calculates server cents and writes order plus item in one batch', async () => {
  const db = new OrderDb()
  const order = await createOrder(db, 'amor-e-sabor', { clientId: 'c1', productId: 'p1', type: 'Entrega', quantity: 2, orderDate: '2026-09-01', idempotencyKey: 'request-1' }, new Date('2026-09-01T20:00:00.000Z'))
  assert.equal(order.total, 64); assert.equal(order.items[0].quantity, 2); assert.equal(order.items[0].catalogPrice, 32); assert.equal(db.batchCalls[0].length, 2); assert.equal([...db.orders.values()][0].total_cents, 6400)
})

test('same order idempotency key returns one backdated finalized order', async () => {
  const db = new OrderDb(); const payload = { clientId: 'c1', productId: 'p1', type: 'Retirada', quantity: 1, orderDate: '2026-08-31', idempotencyKey: 'same-key' }
  const first = await createOrder(db, 'amor-e-sabor', payload, new Date('2026-09-01T20:00:00.000Z')); const second = await createOrder(db, 'amor-e-sabor', payload, new Date('2026-09-01T20:01:00.000Z'))
  assert.equal(first.id, second.id); assert.equal(first.status, 'Finalizado'); assert.equal(db.orders.size, 1)
})

test('payment uses official total and duplicate payment creates no second movement', async () => {
  const db = new OrderDb(); const order = await createOrder(db, 'amor-e-sabor', { clientId: 'c1', productId: 'p1', type: 'Entrega', quantity: 2, orderDate: '2026-09-01', idempotencyKey: 'pay-order' }, new Date('2026-09-01T20:00:00.000Z'))
  const result = await registerOrderPayment(db, 'amor-e-sabor', order.id, 'Pix', new Date('2026-09-01T20:05:00.000Z'))
  assert.equal(result.payment.amount, 64); assert.equal(result.movement.value, 64); assert.equal(result.order.paymentStatus, 'Pago'); assert.equal(db.movements.size, 1)
  await assert.rejects(() => registerOrderPayment(db, 'amor-e-sabor', order.id, 'Pix'), (error) => error.status === 409 && error.code === 'ORDER_ALREADY_PAID'); assert.equal(db.movements.size, 1)
})

test('single-order payment returns the closed table tab effect when it settles the tab', async () => {
  const db = new OrderDb()
  const order = await createOrder(db, 'amor-e-sabor', { clientId: 'c1', productId: 'p1', type: 'Local', quantity: 1, orderDate: '2026-09-01', idempotencyKey: 'tab-pay' }, new Date('2026-09-01T20:00:00.000Z'))
  db.tableTabs.set('tab-1', { id: 'tab-1', business_id: 'amor-e-sabor', table_identifier: '04', status: 'open', opened_at: '2026-09-01T19:00:00.000Z', closed_at: null })
  db.orders.get(order.id).table_tab_id = 'tab-1'

  const result = await registerOrderPayment(db, 'amor-e-sabor', order.id, 'Pix', new Date('2026-09-01T20:05:00.000Z'))

  assert.equal(result.tableTab.status, 'closed')
  assert.equal(result.tableTab.id, 'tab-1')
})

test('paid checkout movement can be loaded by authoritative order source', async () => {
  const repositories = await import('./repositories.js')
  assert.equal(typeof repositories.loadMovementByOrderSource, 'function')

  const db = new OrderDb()
  const order = await createOrder(db, 'amor-e-sabor', {
    clientId: 'c1', productId: 'p1', type: 'Entrega', quantity: 1, orderDate: '2026-09-01', idempotencyKey: 'paid-create', paymentMethod: 'Pix',
  }, new Date('2026-09-01T20:00:00.000Z'))

  const movement = await repositories.loadMovementByOrderSource(db, 'amor-e-sabor', order.id, 'order-payment')
  assert.equal(movement.source, 'order-payment')
  assert.equal(movement.orderId, order.id)
  assert.equal(movement.value, order.total)
})

test('finalization is idempotent and preserves paid order audit history', async () => {
  const db = new OrderDb(); const order = await createOrder(db, 'amor-e-sabor', { clientId: 'c1', productId: 'p1', type: 'Entrega', quantity: 1, orderDate: '2026-09-01', idempotencyKey: 'finish' }, new Date('2026-09-01T20:00:00.000Z'))
  const finalized = await updateOrderStatus(db, 'amor-e-sabor', order.id, new Date('2026-09-01T20:10:00.000Z')); const again = await updateOrderStatus(db, 'amor-e-sabor', order.id, new Date('2026-09-01T20:20:00.000Z')); assert.equal(again.finishedAt, finalized.finishedAt)
  await registerOrderPayment(db, 'amor-e-sabor', order.id, 'Dinheiro', new Date('2026-09-01T20:30:00.000Z')); assert.equal(db.orders.size, 1); assert.equal(db.movements.size, 1); assert.equal([...db.movements.values()][0].source, 'order-payment')
})

test('manual movement stores integer cents and business scope', async () => {
  const db = new OrderDb(); const movement = await createMovement(db, 'amor-e-sabor', { type: 'saida', category: 'Insumos', description: 'Arroz', valueCents: 2050 }, new Date('2026-09-01T20:00:00.000Z'))
  assert.equal(movement.value, 20.5); assert.equal(movement.source, 'manual'); assert.equal([...db.movements.values()][0].business_id, 'amor-e-sabor')
})
