import assert from 'node:assert/strict'
import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { createOrder, registerTableTabPayment } from './repositories.js'

const lifecycleSql = () => fs.readFileSync(new URL('../migrations/0021_table_tab_lifecycle_guards.sql', import.meta.url), 'utf8')
const timestamp = '2026-09-10T18:00:00.000Z'

class D1Sqlite {
  constructor({ withOrder = true } = {}) {
    this.sqlite = new DatabaseSync(':memory:')
    this.beforeBatch = null
    this.batchTail = Promise.resolve()
    this.sqlite.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE businesses (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE tables (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL, name_key TEXT NOT NULL, sort_order INTEGER NOT NULL, is_active INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE table_tabs (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, table_id TEXT, table_identifier TEXT NOT NULL, tab_number INTEGER NOT NULL, status TEXT NOT NULL, opened_at TEXT NOT NULL, closed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE table_tab_counters (business_id TEXT PRIMARY KEY, last_number INTEGER NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE clients (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT, address TEXT);
      CREATE TABLE products (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, category TEXT NOT NULL, size TEXT NOT NULL, presentation_type TEXT, presentation_value TEXT, presentation_unit TEXT, name TEXT NOT NULL, price_cents INTEGER NOT NULL, active INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE orders (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, client_id TEXT, client_name_snapshot TEXT NOT NULL, client_phone_snapshot TEXT NOT NULL DEFAULT '', client_address_snapshot TEXT NOT NULL DEFAULT '', customer_identity_type TEXT NOT NULL, table_tab_id TEXT, type TEXT NOT NULL, order_date TEXT NOT NULL, status TEXT NOT NULL, scheduled_for TEXT, promised_payment_date TEXT, is_backdated INTEGER NOT NULL DEFAULT 0, subtotal_cents INTEGER NOT NULL, delivery_fee_cents INTEGER NOT NULL, adjustment_type TEXT NOT NULL, adjustment_mode TEXT NOT NULL, adjustment_value INTEGER NOT NULL, adjustment_amount_cents INTEGER NOT NULL, adjustment_reason TEXT NOT NULL, total_cents INTEGER NOT NULL, created_at TEXT NOT NULL, finished_at TEXT, cancelled_at TEXT, cancel_reason TEXT, cancel_reason_note TEXT, idempotency_key TEXT NOT NULL);
      CREATE UNIQUE INDEX orders_business_idempotency_idx ON orders (business_id, idempotency_key);
      CREATE TABLE order_items (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT NOT NULL, product_id TEXT, name_snapshot TEXT NOT NULL, category_snapshot TEXT NOT NULL, size_snapshot TEXT NOT NULL, quantity INTEGER NOT NULL, catalog_price_cents INTEGER NOT NULL, unit_price_cents INTEGER NOT NULL, price_reason TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL);
      CREATE TABLE payments (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT NOT NULL UNIQUE, amount_cents INTEGER NOT NULL, method TEXT NOT NULL, paid_at TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE movements (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, type TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, value_cents INTEGER NOT NULL, source TEXT NOT NULL, order_id TEXT, payment_id TEXT, payment_method TEXT, movement_date TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT, deleted_at TEXT);
      CREATE TABLE print_stations (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL, platform TEXT NOT NULL, is_primary INTEGER NOT NULL, auto_print_enabled INTEGER NOT NULL, default_copies INTEGER NOT NULL, last_seen_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE print_jobs (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT, type TEXT NOT NULL, trigger TEXT NOT NULL, status TEXT NOT NULL, copies_requested INTEGER NOT NULL, copies_printed INTEGER NOT NULL, station_id TEXT, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL, available_at TEXT NOT NULL, processing_started_at TEXT, processed_at TEXT, last_error_code TEXT, last_error_message TEXT);
      INSERT INTO businesses VALUES ('amor-e-sabor', 'Amor & Sabor'), ('other-business', 'Other');
      INSERT INTO tables VALUES
        ('table-1', 'amor-e-sabor', 'Mesa 1', 'MESA 1', 1, 1, '${timestamp}', '${timestamp}'),
        ('table-2', 'amor-e-sabor', 'Mesa 2', 'MESA 2', 2, 1, '${timestamp}', '${timestamp}');
      INSERT INTO table_tabs VALUES ('tab-1', 'amor-e-sabor', 'table-1', 'Mesa 1', 1, 'open', '${timestamp}', NULL, '${timestamp}', '${timestamp}');
      INSERT INTO table_tab_counters VALUES ('amor-e-sabor', 1, '${timestamp}');
      INSERT INTO products VALUES ('product-1', 'amor-e-sabor', 'Lanches', 'Un', 'unit', '', '', 'X-Burger', 2500, 1, '${timestamp}', '${timestamp}');
    `)
    if (withOrder) this.insertOrder('order-1', 'tab-1', 'seed-order')
    this.sqlite.exec(lifecycleSql())
  }

  insertOrder(id, tabId, key) {
    this.sqlite.prepare(`INSERT INTO orders VALUES (?, 'amor-e-sabor', NULL, 'Mesa 1', '', '', 'table', ?, 'Local', '2026-09-10', 'Em preparo', NULL, NULL, 0, 2500, 0, 'none', 'fixed', 0, 0, '', 2500, ?, NULL, NULL, NULL, NULL, ?)`).run(id, tabId, timestamp, key)
  }

  prepare(sql) {
    const database = this.sqlite
    return { bind(...values) { return {
      async first() { return database.prepare(sql).get(...values) ?? null },
      async all() { return { results: database.prepare(sql).all(...values) } },
      async run() { const result = database.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes || 0) } } },
    } } }
  }

  async batch(statements) {
    const execute = async () => {
      if (this.beforeBatch) {
        const hook = this.beforeBatch
        this.beforeBatch = null
        await hook()
      }
      this.sqlite.exec('BEGIN')
      try {
        const results = []
        for (const statement of statements) results.push(await statement.run())
        this.sqlite.exec('COMMIT')
        return results
      } catch (error) {
        this.sqlite.exec('ROLLBACK')
        throw error
      }
    }
    const pending = this.batchTail.then(execute, execute)
    this.batchTail = pending.catch(() => {})
    return pending
  }
}

const tableOrderInput = (expectedTableTabId = 'tab-1', key = crypto.randomUUID()) => ({
  customerIdentity: { type: 'table', tableId: 'table-1' }, expectedTableTabId,
  type: 'Local', orderDate: '2026-09-10', idempotencyKey: key,
  items: [{ productId: 'product-1', quantity: 1, note: '' }], deliveryFeeCents: 0,
  adjustment: { type: 'none', mode: 'fixed', storedValue: 0, reason: '' }, paymentMethod: null,
})

test('an added order racing full payment cannot leave a closed tab with unpaid work', async () => {
  const db = new D1Sqlite()
  db.beforeBatch = async () => db.insertOrder('order-racing', 'tab-1', 'racing-order')

  await assert.rejects(
    () => registerTableTabPayment(db, 'amor-e-sabor', 'tab-1', 'Pix', new Date(timestamp)),
    (error) => error.status === 409 && error.code === 'TABLE_TAB_PAYMENT_CONFLICT',
  )
  assert.equal(db.sqlite.prepare("SELECT status FROM table_tabs WHERE id = 'tab-1'").get().status, 'open')
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM payments').get().count, 0)
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM movements').get().count, 0)
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM orders WHERE table_tab_id = 'tab-1'").get().count, 2)
})

test('two full payments produce one settlement and one stable conflict', async () => {
  const db = new D1Sqlite()
  const results = await Promise.allSettled([
    registerTableTabPayment(db, 'amor-e-sabor', 'tab-1', 'Pix', new Date(timestamp)),
    registerTableTabPayment(db, 'amor-e-sabor', 'tab-1', 'Dinheiro', new Date(timestamp)),
  ])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  const rejected = results.find((result) => result.status === 'rejected')
  assert.equal(rejected.reason.status, 409)
  assert.match(rejected.reason.code, /^TABLE_TAB_(?:ALREADY_CLOSED|PAYMENT_CONFLICT)$/)
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM payments').get().count, 1)
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM movements').get().count, 1)
  assert.equal(db.sqlite.prepare("SELECT status FROM table_tabs WHERE id = 'tab-1'").get().status, 'closed')
})

test('expected table tab identity allows same-tab reuse and rejects close transfer or replacement', async () => {
  const successDb = new D1Sqlite({ withOrder: false })
  const created = await createOrder(successDb, 'amor-e-sabor', tableOrderInput('tab-1', 'same-tab'), new Date(timestamp))
  assert.equal(created.tableTabId, 'tab-1')

  for (const state of ['closed', 'transferred', 'replaced']) {
    const db = new D1Sqlite({ withOrder: false })
    if (state === 'closed') db.sqlite.prepare("UPDATE table_tabs SET status = 'closed' WHERE id = 'tab-1'").run()
    if (state === 'transferred') db.sqlite.prepare("UPDATE table_tabs SET table_id = 'table-2' WHERE id = 'tab-1'").run()
    if (state === 'replaced') db.sqlite.exec(`UPDATE table_tabs SET status = 'closed' WHERE id = 'tab-1'; INSERT INTO table_tabs VALUES ('tab-2', 'amor-e-sabor', 'table-1', 'Mesa 1', 2, 'open', '${timestamp}', NULL, '${timestamp}', '${timestamp}');`)
    await assert.rejects(
      () => createOrder(db, 'amor-e-sabor', tableOrderInput('tab-1', `stale-${state}`), new Date(timestamp)),
      (error) => error.status === 409 && error.code === 'TABLE_TAB_CHANGED',
    )
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 0)
  }
})

test('order insertion that loses a close race returns 409 and rolls back the whole order batch', async () => {
  const db = new D1Sqlite({ withOrder: false })
  db.beforeBatch = async () => db.sqlite.prepare("UPDATE table_tabs SET status = 'closed' WHERE id = 'tab-1'").run()
  await assert.rejects(
    () => createOrder(db, 'amor-e-sabor', tableOrderInput('tab-1', 'close-race'), new Date(timestamp)),
    (error) => error.status === 409 && error.code === 'TABLE_TAB_CHANGED',
  )
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 0)
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM order_items').get().count, 0)
})

test('repository rejects immediate payment for a table order even without route validation', async () => {
  const db = new D1Sqlite({ withOrder: false })
  await assert.rejects(
    () => createOrder(db, 'amor-e-sabor', { ...tableOrderInput('tab-1', 'paid-table-repository'), paymentMethod: 'Pix' }, new Date(timestamp)),
    (error) => error.status === 400 && error.code === 'TABLE_ORDER_PAYMENT_NOT_ALLOWED',
  )
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 0)
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM payments').get().count, 0)
})
