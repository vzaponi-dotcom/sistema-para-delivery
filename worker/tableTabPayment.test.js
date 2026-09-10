import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTableTabPayment } from './repositories.js'
import { listTables } from './tableRepository.js'

class TableTabPaymentDb {
  constructor() {
    this.tableTabs = [
      { id: 'tab-1', business_id: 'amor-e-sabor', table_id: 'table-4', table_identifier: '04', tab_number: 37, status: 'open', opened_at: '2026-09-02T18:00:00.000Z', closed_at: null },
      { id: 'tab-closed', business_id: 'amor-e-sabor', table_id: 'table-5', table_identifier: '05', tab_number: 36, status: 'closed', opened_at: '2026-09-02T16:00:00.000Z', closed_at: '2026-09-02T17:00:00.000Z' },
    ]
    this.tables = [
      { id: 'table-4', business_id: 'amor-e-sabor', name: 'Mesa 4', sort_order: 4, is_active: 1 },
      { id: 'table-5', business_id: 'amor-e-sabor', name: 'Mesa 5', sort_order: 5, is_active: 1 },
    ]
    this.orders = [
      { id: 'o1', business_id: 'amor-e-sabor', table_tab_id: 'tab-1', client_id: null, client_name_snapshot: 'Mesa 04', customer_identity_type: 'table', type: 'Local', order_date: '2026-09-02', status: 'Em preparo', subtotal_cents: 2000, delivery_fee_cents: 0, adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0, adjustment_amount_cents: 0, adjustment_reason: '', total_cents: 2000, created_at: '2026-09-02T18:00:00.000Z', finished_at: null },
      { id: 'o2', business_id: 'amor-e-sabor', table_tab_id: 'tab-1', client_id: null, client_name_snapshot: 'Mesa 04', customer_identity_type: 'table', type: 'Local', order_date: '2026-09-02', status: 'Em preparo', subtotal_cents: 3000, delivery_fee_cents: 0, adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0, adjustment_amount_cents: 0, adjustment_reason: '', total_cents: 3000, created_at: '2026-09-02T18:05:00.000Z', finished_at: null },
      { id: 'o3', business_id: 'amor-e-sabor', table_tab_id: 'tab-1', client_id: null, client_name_snapshot: 'Mesa 04', customer_identity_type: 'table', type: 'Local', order_date: '2026-09-02', status: 'Em preparo', subtotal_cents: 1000, delivery_fee_cents: 0, adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0, adjustment_amount_cents: 0, adjustment_reason: '', total_cents: 1000, created_at: '2026-09-02T18:10:00.000Z', finished_at: null },
    ]
    this.payments = [{ id: 'pay-old', business_id: 'amor-e-sabor', order_id: 'o1', amount_cents: 2000, method: 'Dinheiro', paid_at: '2026-09-02T18:02:00.000Z', created_at: '2026-09-02T18:02:00.000Z' }]
    this.movements = [{ id: 'mov-old', business_id: 'amor-e-sabor', type: 'entrada', category: 'Vendas', description: 'Pagamento pedido #o1 · Mesa 04', value_cents: 2000, source: 'order-payment', order_id: 'o1', payment_id: 'pay-old', movement_date: '2026-09-02', created_at: '2026-09-02T18:02:00.000Z' }]
  }

  prepare(sql) {
    const db = this
    return {
      bind(...values) {
        return {
          sql,
          values,
          async first() {
            if (sql.includes('FROM table_tabs')) {
              const [tabId, businessId] = values
              return db.tableTabs.find((tab) => tab.id === tabId && tab.business_id === businessId) ?? null
            }
            if (sql.includes('COUNT(*) AS count')) {
              const [businessId, tabId] = values
              const count = db.orders.filter((order) => order.business_id === businessId && order.table_tab_id === tabId && !db.payments.some((payment) => payment.business_id === businessId && payment.order_id === order.id)).length
              return { count }
            }
            if (sql.includes('FROM orders') && sql.includes('payment_id')) {
              const [id, businessId] = values
              const row = db.orders.find((order) => order.id === id && order.business_id === businessId)
              if (!row) return null
              const payment = db.payments.find((entry) => entry.order_id === id && entry.business_id === businessId)
              return { ...row, payment_id: payment?.id ?? null, payment_method: payment?.method ?? null, paid_at: payment?.paid_at ?? null, paid_amount_cents: payment?.amount_cents ?? null }
            }
            return null
          },
          async all() {
            if (sql.includes('FROM tables') && sql.includes('open_tabs')) {
              const [businessId] = values
              return {
                results: db.tables.map((table) => ({
                  ...table,
                  open_table_tab_id: db.tableTabs.find((tab) => (
                    tab.business_id === businessId && tab.table_id === table.id && tab.status === 'open'
                  ))?.id ?? null,
                })),
              }
            }
            if (sql.includes('FROM orders o') && sql.includes('table_tab_id') && sql.includes('p.id IS NULL')) {
              const [businessId, tabId] = values
              return { results: db.orders.filter((order) => order.business_id === businessId && order.table_tab_id === tabId && !db.payments.some((payment) => payment.business_id === businessId && payment.order_id === order.id)).map((order) => ({ id: order.id, client_name_snapshot: order.client_name_snapshot, total_cents: order.total_cents })) }
            }
            if (sql.includes('FROM order_items')) return { results: [] }
            return { results: [] }
          },
          async run() {
            if (sql.includes('INSERT INTO payments')) {
              const [id, businessId, orderId, amount, method, paidAt, createdAt] = values
              db.payments.push({ id, business_id: businessId, order_id: orderId, amount_cents: amount, method, paid_at: paidAt, created_at: createdAt })
            } else if (sql.includes('INSERT INTO movements')) {
              const [id, businessId, type, category, description, value, source, orderId, paymentId, movementDate, createdAt] = values
              db.movements.push({ id, business_id: businessId, type, category, description, value_cents: value, source, order_id: orderId, payment_id: paymentId, movement_date: movementDate, created_at: createdAt })
            } else if (sql.includes('UPDATE table_tabs SET status')) {
              const [closedAt, updatedAt, tabId, businessId] = values
              const tab = db.tableTabs.find((entry) => entry.id === tabId && entry.business_id === businessId && entry.status === 'open')
              if (tab) Object.assign(tab, { status: 'closed', closed_at: closedAt, updated_at: updatedAt })
            }
            return { success: true }
          },
        }
      },
    }
  }

  async batch(statements) {
    const snapshots = {
      payments: this.payments.map((item) => ({ ...item })),
      movements: this.movements.map((item) => ({ ...item })),
      tableTabs: this.tableTabs.map((item) => ({ ...item })),
    }
    try {
      return await Promise.all(statements.map((statement) => statement.run()))
    } catch (error) {
      this.payments = snapshots.payments
      this.movements = snapshots.movements
      this.tableTabs = snapshots.tableTabs
      throw error
    }
  }
}

test('table tab payment settles every pending order once and closes the tab', async () => {
  const db = new TableTabPaymentDb()
  const now = new Date('2026-09-02T19:00:00.000Z')
  const result = await registerTableTabPayment(db, 'amor-e-sabor', 'tab-1', 'Pix', now)

  assert.equal(result.orders.length, 2)
  assert.equal(result.movements.length, 2)
  assert.equal(result.tableTab.status, 'closed')
  assert.equal(result.tableTab.tabNumber, 37)
  assert.equal(db.payments.length, 3)
  assert.equal(db.movements.filter((item) => item.source === 'order-payment').length, 3)
  assert.deepEqual(result.orders.map((order) => order.paymentStatus), ['Pago', 'Pago'])
})

test('table tab payment enforces business scope and closed-tab retry safety', async () => {
  const db = new TableTabPaymentDb()
  const now = new Date('2026-09-02T19:00:00.000Z')

  await assert.rejects(
    () => registerTableTabPayment(db, 'other-business', 'tab-1', 'Pix', now),
    (error) => error.code === 'TABLE_TAB_NOT_FOUND',
  )
  await assert.rejects(
    () => registerTableTabPayment(db, 'amor-e-sabor', 'tab-closed', 'Pix', now),
    (error) => error.code === 'TABLE_TAB_ALREADY_CLOSED',
  )
})

test('table tab payment keeps the transferred tab id and releases the destination table', async () => {
  const db = new TableTabPaymentDb()
  db.tableTabs[0].table_id = 'table-5'
  db.tableTabs[0].table_identifier = 'Mesa 5'
  for (const order of db.orders) order.client_name_snapshot = 'Mesa 5'
  const now = new Date('2026-09-02T19:00:00.000Z')

  const result = await registerTableTabPayment(db, 'amor-e-sabor', 'tab-1', 'Pix', now)

  assert.equal(result.tableTab.id, 'tab-1')
  assert.equal(result.tableTab.tableId, 'table-5')
  assert.equal(result.tableTab.tabNumber, 37)
  assert.equal(result.tableTab.status, 'closed')
  assert.equal((await listTables(db, 'amor-e-sabor')).find((table) => table.id === 'table-5').occupancy, 'free')
  assert.equal(db.tableTabs.filter((tab) => tab.status === 'open').length, 0)
})
