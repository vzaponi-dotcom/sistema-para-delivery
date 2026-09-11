import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { getBusinessDate } from '../shared/finance.js'
import { hashPin } from './auth.js'
import { handleRequest } from './index.js'

class D1Sqlite {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:')
    this.sqlite.exec(`
      CREATE TABLE businesses (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE auth_credentials (business_id TEXT PRIMARY KEY, pin_hash TEXT NOT NULL);
      CREATE TABLE sessions (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, token_hash TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, revoked_at TEXT);
      CREATE TABLE tables (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL, name_key TEXT NOT NULL, sort_order INTEGER NOT NULL, is_active INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE table_tabs (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, table_id TEXT, table_identifier TEXT NOT NULL, tab_number INTEGER NOT NULL, status TEXT NOT NULL, opened_at TEXT NOT NULL, closed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE table_tab_counters (business_id TEXT PRIMARY KEY, last_number INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
      CREATE TABLE clients (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT, address TEXT);
      CREATE TABLE products (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, category TEXT NOT NULL, size TEXT NOT NULL, presentation_type TEXT, presentation_value TEXT, presentation_unit TEXT, name TEXT NOT NULL, price_cents INTEGER NOT NULL, active INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE orders (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, client_id TEXT, client_name_snapshot TEXT NOT NULL, client_phone_snapshot TEXT NOT NULL DEFAULT '', client_address_snapshot TEXT NOT NULL DEFAULT '', customer_identity_type TEXT NOT NULL, table_tab_id TEXT, type TEXT NOT NULL, order_date TEXT NOT NULL, status TEXT NOT NULL, scheduled_for TEXT, promised_payment_date TEXT, is_backdated INTEGER NOT NULL DEFAULT 0, subtotal_cents INTEGER NOT NULL, delivery_fee_cents INTEGER NOT NULL, adjustment_type TEXT NOT NULL, adjustment_mode TEXT NOT NULL, adjustment_value INTEGER NOT NULL, adjustment_amount_cents INTEGER NOT NULL, adjustment_reason TEXT NOT NULL, total_cents INTEGER NOT NULL, created_at TEXT NOT NULL, finished_at TEXT, cancelled_at TEXT, cancel_reason TEXT, cancel_reason_note TEXT, idempotency_key TEXT NOT NULL);
      CREATE TABLE order_items (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT NOT NULL, product_id TEXT, name_snapshot TEXT NOT NULL, category_snapshot TEXT NOT NULL, size_snapshot TEXT NOT NULL, quantity INTEGER NOT NULL, catalog_price_cents INTEGER NOT NULL, unit_price_cents INTEGER NOT NULL, price_reason TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL);
      CREATE TABLE payments (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT NOT NULL, amount_cents INTEGER NOT NULL, method TEXT NOT NULL, paid_at TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE movements (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, type TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, value_cents INTEGER NOT NULL, source TEXT NOT NULL, order_id TEXT, payment_id TEXT, payment_method TEXT, movement_date TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT, deleted_at TEXT);
      CREATE TABLE print_stations (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL, platform TEXT NOT NULL, is_primary INTEGER NOT NULL DEFAULT 0, auto_print_enabled INTEGER NOT NULL DEFAULT 0, default_copies INTEGER NOT NULL DEFAULT 2, last_seen_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE print_jobs (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT, type TEXT NOT NULL, trigger TEXT NOT NULL, status TEXT NOT NULL, copies_requested INTEGER NOT NULL, copies_printed INTEGER NOT NULL DEFAULT 0, station_id TEXT, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL, available_at TEXT NOT NULL, processing_started_at TEXT, processed_at TEXT, last_error_code TEXT, last_error_message TEXT);
      INSERT INTO businesses VALUES ('amor-e-sabor', 'Amor & Sabor'), ('foreign-business', 'Foreign');
    `)
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
}

const timestamp = '2026-09-10T18:00:00.000Z'
const printingMigrationSql = () => ['0014_centralized_print_queue.sql', '0015_print_job_awaiting_second_copy.sql', '0016_second_copy_prompt_acknowledgment.sql', '0018_second_copy_decisions.sql', '0019_print_operational_confirmation.sql', '0022_table_tab_print_jobs.sql']
  .map((file) => { try { return fs.readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8') } catch { return '' } })
const orderNumbersSql = () => fs.readFileSync(new URL('../migrations/0017_order_numbers.sql', import.meta.url), 'utf8')

const seed = (db) => {
  db.sqlite.exec(`
    INSERT INTO tables VALUES
      ('table-1', 'amor-e-sabor', 'Mesa 1', 'MESA 1', 1, 1, '${timestamp}', '${timestamp}'),
      ('table-closed', 'amor-e-sabor', 'Mesa fechada', 'MESA FECHADA', 2, 1, '${timestamp}', '${timestamp}'),
      ('foreign-table', 'foreign-business', 'Mesa estrangeira', 'MESA ESTRANGEIRA', 1, 1, '${timestamp}', '${timestamp}');
    INSERT INTO table_tabs VALUES
      ('tab-1', 'amor-e-sabor', 'table-1', 'Mesa 1', 1042, 'open', '${timestamp}', NULL, '${timestamp}', '${timestamp}'),
      ('tab-closed', 'amor-e-sabor', 'table-closed', 'Mesa fechada', 1041, 'closed', '${timestamp}', '${timestamp}', '${timestamp}', '${timestamp}'),
      ('tab-foreign', 'foreign-business', 'foreign-table', 'Mesa estrangeira', 1, 'open', '${timestamp}', NULL, '${timestamp}', '${timestamp}');
    INSERT INTO table_tab_counters VALUES ('amor-e-sabor', 1042, '${timestamp}');
    INSERT INTO clients VALUES ('client-1', 'amor-e-sabor', 'Maria', '11999999999', 'Rua A');
    INSERT INTO products VALUES ('product-1', 'amor-e-sabor', 'Lanches', 'Un', 'unit', '', '', 'X-Burger', 2500, 1, '${timestamp}', '${timestamp}');
    INSERT INTO orders VALUES ('order-1', 'amor-e-sabor', NULL, 'Mesa 1', '', '', 'table', 'tab-1', 'Local', '2026-09-10', 'Em preparo', NULL, NULL, 0, 2500, 0, 'none', 'fixed', 0, 0, '', 2500, '${timestamp}', NULL, NULL, NULL, NULL, 'seed-order');
    INSERT INTO order_items VALUES ('item-1', 'amor-e-sabor', 'order-1', 'product-1', 'X-Burger', 'Lanches', 'Un', 1, 2500, 2500, '', 'sem cebola', '${timestamp}');
  `)
}

const authenticated = async () => {
  const db = new D1Sqlite()
  seed(db)
  for (const sql of printingMigrationSql()) db.sqlite.exec(sql)
  db.sqlite.exec(orderNumbersSql())
  db.sqlite.prepare('INSERT INTO auth_credentials VALUES (?, ?)').run(
    'amor-e-sabor',
    await hashPin('4827', new Uint8Array(16).fill(7)),
  )
  const env = { DB: db, LOGIN_RATE_LIMITER: { limit: async () => ({ success: true }) } }
  const login = await handleRequest(new Request('https://delivery.example/api/auth/login', {
    method: 'POST',
    headers: { origin: 'https://delivery.example', 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '4827' }),
  }), env)
  return { env, cookie: login.headers.get('set-cookie').split(';')[0] }
}

const request = (env, cookie, method, path, { body, origin = true, idempotencyKey } = {}) => handleRequest(
  new Request(`https://delivery.example${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin: 'https://delivery.example' } : {}),
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      'content-type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }),
  env,
)

test('authenticated operator can load one open tab detail and its canonical print document without creating jobs', async () => {
  const { env, cookie } = await authenticated()
  const detailResponse = await request(env, cookie, 'GET', '/api/table-tabs/tab-1')
  assert.equal(detailResponse.status, 200)
  const { tableTab } = await detailResponse.json()
  assert.equal(tableTab.number, 1042)
  assert.equal(tableTab.totalCents, 2500)

  const printResponse = await request(env, cookie, 'GET', '/api/table-tabs/tab-1/print-document')
  assert.equal(printResponse.status, 200)
  const { document } = await printResponse.json()
  assert.equal(document.type, 'table-tab')
  assert.equal(document.tableTab.number, 1042)
  assert.equal(document.financial.totalCents, tableTab.totalCents)
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS count FROM print_jobs').get().count, 0)
})

test('authenticated operator queues one canonical consolidated comanda without local printer state', async () => {
  const { env, cookie } = await authenticated()
  const response = await request(env, cookie, 'POST', '/api/table-tabs/tab-1/print-jobs', { body: {} })
  assert.equal(response.status, 201)
  const { job } = await response.json()
  assert.equal(job.type, 'table-tab')
  assert.equal(job.tableTabId, 'tab-1')
  assert.equal(job.orderId, null)
  assert.equal(job.copiesRequested, 1)
  assert.equal(job.status, 'pending')
  assert.equal(job.document.type, 'table-tab')
  assert.equal(job.document.tableTab.number, 1042)
  assert.equal(job.document.financial.totalCents, 2500)

  for (const id of ['tab-closed', 'tab-foreign', 'missing']) {
    const rejected = await request(env, cookie, 'POST', `/api/table-tabs/${id}/print-jobs`, { body: {} })
    assert.equal(rejected.status, 404)
    assert.equal((await rejected.json()).error.code, 'TABLE_TAB_NOT_FOUND')
  }
  assert.equal((await request(env, cookie, 'POST', '/api/table-tabs/tab-1/print-jobs', { body: {}, origin: false })).status, 403)
})

test('table tab reads require a session and do not leak closed, missing, or foreign tabs', async () => {
  const { env, cookie } = await authenticated()
  assert.equal((await request(env, null, 'GET', '/api/table-tabs/tab-1')).status, 401)
  for (const id of ['tab-closed', 'missing', 'tab-foreign']) {
    const response = await request(env, cookie, 'GET', `/api/table-tabs/${id}`)
    assert.equal(response.status, 404)
    assert.equal((await response.json()).error.code, 'TABLE_TAB_NOT_FOUND')
  }
  assert.equal((await request(env, cookie, 'GET', '/api/table-tabs/tab-1', { origin: false })).status, 200)
})

test('delivery checkout retains its response contract and creates the centralized automatic print job', async () => {
  const { env, cookie } = await authenticated()
  env.DB.sqlite.exec('DROP TABLE tables')
  const orderDate = getBusinessDate(new Date())
  const created = await request(env, cookie, 'POST', '/api/orders', {
    idempotencyKey: 'delivery-order-response',
    body: {
      customerIdentity: { type: 'registered_client', clientId: 'client-1' },
      type: 'Entrega', orderDate, items: [{ productId: 'product-1', quantity: 1, note: '' }],
      deliveryFee: 0, adjustment: { type: 'none', mode: 'fixed', value: 0, reason: '' },
    },
  })
  assert.equal(created.status, 201)
  const createdPayload = await created.json()
  assert.equal(Object.hasOwn(createdPayload, 'tables'), false)
  assert.equal(createdPayload.order.type, 'Entrega')
  assert.equal(createdPayload.movement, null)
  assert.equal(createdPayload.tableTab, null)
  assert.equal(createdPayload.printJob.orderId, createdPayload.order.id)
  assert.equal(createdPayload.printJob.trigger, 'automatic')
  assert.equal(createdPayload.printJob.status, 'pending')
})

test('a local order opens a fresh stable tab and returns its occupied pending summary before payment', async () => {
  const { env, cookie } = await authenticated()
  env.DB.sqlite.prepare(`INSERT INTO tables VALUES (
    'table-2', 'amor-e-sabor', 'Mesa 2', 'MESA 2', 2, 1, ?, ?
  )`).run(timestamp, timestamp)
  const initialTable = (await (await import('./tableRepository.js')).listTables(env.DB, 'amor-e-sabor'))
    .find((table) => table.id === 'table-2')
  assert.deepEqual(initialTable, {
    id: 'table-2', name: 'Mesa 2', sortOrder: 2, isActive: true,
    occupancy: 'free', openTableTabId: null, openTableTab: null,
  })

  const created = await request(env, cookie, 'POST', '/api/orders', {
    idempotencyKey: 'fresh-local-order',
    body: {
      customerIdentity: { type: 'table', tableId: 'table-2' },
      type: 'Local', orderDate: getBusinessDate(new Date()),
      items: [{ productId: 'product-1', quantity: 1, note: '' }],
      deliveryFee: 0, adjustment: { type: 'none', mode: 'fixed', value: 0, reason: '' },
    },
  })
  assert.equal(created.status, 201)
  const createdPayload = await created.json()
  assert.equal(createdPayload.tableTab.tableId, 'table-2')
  assert.equal(createdPayload.tableTab.tabNumber, 1043)
  const occupied = createdPayload.tables.find((table) => table.id === 'table-2')
  assert.deepEqual(occupied.openTableTab, {
    id: createdPayload.tableTab.id, number: 1043, openedAt: createdPayload.tableTab.openedAt,
    orderCount: 1, itemCount: 1, totalCents: 2500,
  })
  assert.equal(occupied.occupancy, 'occupied')
  assert.equal(occupied.openTableTabId, createdPayload.tableTab.id)

  const paid = await request(env, cookie, 'POST', `/api/table-tabs/${createdPayload.tableTab.id}/payment`, { body: { method: 'Pix' } })
  assert.equal(paid.status, 201)
  const paidPayload = await paid.json()
  assert.equal(paidPayload.tables.find((table) => table.id === 'table-2').occupancy, 'free')
})

test('direct API rejects immediate payment for a table order', async () => {
  const { env, cookie } = await authenticated()
  const response = await request(env, cookie, 'POST', '/api/orders', {
    idempotencyKey: 'paid-table-api',
    body: {
      customerIdentity: { type: 'table', tableId: 'table-1' }, expectedTableTabId: 'tab-1',
      type: 'Local', orderDate: getBusinessDate(new Date()), paymentMethod: 'Pix',
      items: [{ productId: 'product-1', quantity: 1, note: '' }],
      deliveryFee: 0, adjustment: { type: 'none', mode: 'fixed', value: 0, reason: '' },
    },
  })
  assert.equal(response.status, 400)
  const payload = await response.json()
  assert.equal(payload.error.code, 'VALIDATION_ERROR')
  assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) AS count FROM orders WHERE idempotency_key = 'paid-table-api'").get().count, 0)
})

test('direct API returns a stable conflict when the expected comanda was replaced', async () => {
  const { env, cookie } = await authenticated()
  env.DB.sqlite.exec(`
    UPDATE table_tabs SET status = 'closed', closed_at = '${timestamp}' WHERE id = 'tab-1';
    INSERT INTO table_tabs VALUES ('tab-2', 'amor-e-sabor', 'table-1', 'Mesa 1', 1043, 'open', '${timestamp}', NULL, '${timestamp}', '${timestamp}');
  `)
  const response = await request(env, cookie, 'POST', '/api/orders', {
    idempotencyKey: 'stale-tab-api',
    body: {
      customerIdentity: { type: 'table', tableId: 'table-1' }, expectedTableTabId: 'tab-1',
      type: 'Local', orderDate: getBusinessDate(new Date()),
      items: [{ productId: 'product-1', quantity: 1, note: '' }],
      deliveryFee: 0, adjustment: { type: 'none', mode: 'fixed', value: 0, reason: '' },
    },
  })
  assert.equal(response.status, 409)
  assert.equal((await response.json()).error.code, 'TABLE_TAB_CHANGED')
  assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) AS count FROM orders WHERE idempotency_key = 'stale-tab-api'").get().count, 0)
})
