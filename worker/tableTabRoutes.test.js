import assert from 'node:assert/strict'
import test from 'node:test'
import { OperationalDb } from './test-support/operationalDb.js'
import { getBusinessDate } from '../shared/finance.js'
import { hashPin } from './auth.js'
import { handleRequest } from './index.js'

const timestamp = '2026-09-10T18:00:00.000Z'
const seed = (db) => {
  db.sqlite.exec(`
    INSERT INTO tables (id, business_id, name, name_key, sort_order, is_active, created_at, updated_at) VALUES
      ('table-1', 'amor-e-sabor', 'Mesa 1', 'MESA 1', 1, 1, '${timestamp}', '${timestamp}'),
      ('table-closed', 'amor-e-sabor', 'Mesa fechada', 'MESA FECHADA', 2, 1, '${timestamp}', '${timestamp}'),
      ('foreign-table', 'foreign-business', 'Mesa estrangeira', 'MESA ESTRANGEIRA', 1, 1, '${timestamp}', '${timestamp}');
    INSERT INTO table_tabs (id, business_id, table_id, table_identifier, tab_number, status, opened_at, closed_at, created_at, updated_at) VALUES
      ('tab-1', 'amor-e-sabor', 'table-1', 'Mesa 1', 1042, 'open', '${timestamp}', NULL, '${timestamp}', '${timestamp}'),
      ('tab-closed', 'amor-e-sabor', 'table-closed', 'Mesa fechada', 1041, 'closed', '${timestamp}', '${timestamp}', '${timestamp}', '${timestamp}'),
      ('tab-foreign', 'foreign-business', 'foreign-table', 'Mesa estrangeira', 1, 'open', '${timestamp}', NULL, '${timestamp}', '${timestamp}');
    UPDATE table_tab_counters SET last_number = 1042, updated_at = '${timestamp}' WHERE business_id = 'amor-e-sabor';
    INSERT INTO clients (id, business_id, name, phone, address, created_at, updated_at) VALUES ('client-1', 'amor-e-sabor', 'Maria', '11999999999', 'Rua A', '${timestamp}', '${timestamp}');
    INSERT INTO products (id, business_id, category, size, presentation_type, presentation_value, presentation_unit, name, price_cents, active, created_at, updated_at) VALUES ('product-1', 'amor-e-sabor', 'Lanches', 'Un', 'unit', '', '', 'X-Burger', 2500, 1, '${timestamp}', '${timestamp}');
    INSERT INTO orders (id, business_id, client_id, client_name_snapshot, client_phone_snapshot, client_address_snapshot, customer_identity_type, table_tab_id, type, order_date, status, scheduled_for, promised_payment_date, is_backdated, subtotal_cents, delivery_fee_cents, adjustment_type, adjustment_mode, adjustment_value, adjustment_amount_cents, adjustment_reason, total_cents, created_at, finished_at, cancelled_at, cancel_reason, cancel_reason_note, idempotency_key, order_number) VALUES ('order-1', 'amor-e-sabor', NULL, 'Mesa 1', '', '', 'table', 'tab-1', 'Local', '2026-09-10', 'Em preparo', NULL, NULL, 0, 2500, 0, 'none', 'fixed', 0, 0, '', 2500, '${timestamp}', NULL, NULL, NULL, NULL, 'seed-order', 1);
    INSERT INTO order_items (id, business_id, order_id, product_id, name_snapshot, category_snapshot, size_snapshot, quantity, catalog_price_cents, unit_price_cents, price_reason, note, created_at) VALUES ('item-1', 'amor-e-sabor', 'order-1', 'product-1', 'X-Burger', 'Lanches', 'Un', 1, 2500, 2500, '', 'sem cebola', '${timestamp}');
    INSERT INTO order_sequences (business_id, last_order_number) VALUES ('amor-e-sabor', 1);
  `)
}

const authenticated = async () => {
  const db = new OperationalDb({ businesses: ['foreign-business'] })
  seed(db)
  db.sqlite.prepare('INSERT INTO auth_credentials (business_id, pin_hash, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    'amor-e-sabor',
    await hashPin('4827', new Uint8Array(16).fill(7)), timestamp, timestamp,
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
  const prepare = env.DB.prepare
  env.DB.prepare = (sql) => {
    assert.doesNotMatch(sql, /\bFROM tables\b/i, 'delivery checkout must not query table occupancy')
    return prepare(sql)
  }
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
  env.DB.sqlite.prepare(`INSERT INTO tables (id, business_id, name, name_key, sort_order, is_active, created_at, updated_at) VALUES (
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
  const paid = await request(env, cookie, 'POST', '/api/table-tabs/tab-1/payment', { body: { method: 'Pix' } })
  assert.equal(paid.status, 201)
  env.DB.sqlite.exec(`
    UPDATE table_tabs SET status = 'closed', closed_at = '${timestamp}' WHERE id = 'tab-1';
    INSERT INTO table_tabs (id, business_id, table_id, table_identifier, tab_number, status, opened_at, closed_at, created_at, updated_at) VALUES ('tab-2', 'amor-e-sabor', 'table-1', 'Mesa 1', 1043, 'open', '${timestamp}', NULL, '${timestamp}', '${timestamp}');
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
