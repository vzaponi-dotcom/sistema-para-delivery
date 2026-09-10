import test from 'node:test'
import assert from 'node:assert/strict'
import { hashPin } from './auth.js'
import { handleRequest } from './index.js'

class FakeDb {
  constructor(pinHash) {
    this.pinHash = pinHash
    this.sessions = []
    this.clients = new Map()
    this.products = new Map()
    this.orders = new Map()
    this.tables = new Map()
    this.tableTabs = new Map()
  }

  prepare(sql) {
    const db = this
    return {
      bind(...values) {
        return {
          async first() {
            if (sql.includes('FROM auth_credentials')) {
              return values[0] === 'amor-e-sabor' ? { pin_hash: db.pinHash } : null
            }
            if (sql.includes('FROM sessions')) {
              return db.sessions.find((session) => session.token_hash === values[0]) ?? null
            }
            if (sql.includes('FROM clients')) {
              const [id, businessId] = values
              const row = db.clients.get(id)
              return row?.business_id === businessId ? row : null
            }
            if (sql.includes('FROM products')) {
              const [id, businessId] = values
              const row = db.products.get(id)
              return row?.business_id === businessId && row.active !== 0 ? row : null
            }
            if (sql.includes('FROM orders')) {
              const [id, businessId] = values
              const row = db.orders.get(id)
              return row?.business_id === businessId ? row : null
            }
            return null
          },
          async all() {
            if (sql.includes('FROM tables')) {
              return {
                results: [...db.tables.values()]
                  .filter((table) => table.business_id === values[0])
                  .map((table) => {
                    const openTab = [...db.tableTabs.values()].find((tab) => (
                      tab.business_id === table.business_id
                      && tab.table_id === table.id
                      && tab.status === 'open'
                    ))
                    return {
                      ...table,
                      open_table_tab_id: openTab?.id ?? null,
                      open_table_tab_number: openTab?.tab_number ?? null,
                      open_table_tab_opened_at: openTab?.opened_at ?? null,
                      open_table_tab_order_count: 0,
                      open_table_tab_item_count: 0,
                      open_table_tab_total_cents: 0,
                    }
                  })
                  .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name)),
              }
            }
            if (sql.includes('FROM table_tabs')) {
              return {
                results: [...db.tableTabs.values()]
                  .filter((tab) => tab.business_id === values[0])
                  .sort((left, right) => right.opened_at.localeCompare(left.opened_at)),
              }
            }
            return { results: [] }
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
            } else if (sql.includes('INSERT INTO sessions')) {
              const [id, businessId, tokenHash, createdAt, expiresAt, lastSeenAt] = values
              db.sessions.push({ id, business_id: businessId, token_hash: tokenHash, created_at: createdAt, expires_at: expiresAt, last_seen_at: lastSeenAt, revoked_at: null })
            } else if (sql.includes('SET last_seen_at')) {
              const [lastSeenAt, id, businessId] = values
              const session = db.sessions.find((item) => item.id === id && item.business_id === businessId)
              if (session) session.last_seen_at = lastSeenAt
            } else if (sql.includes('SET revoked_at')) {
              const [revokedAt, tokenHash] = values
              const session = db.sessions.find((item) => item.token_hash === tokenHash)
              if (session) session.revoked_at = revokedAt
            } else if (sql.includes('UPDATE orders SET promised_payment_date')) {
              const [promisedPaymentDate, id, businessId] = values
              const row = db.orders.get(id)
              if (row?.business_id === businessId) row.promised_payment_date = promisedPaymentDate
            }
            return { success: true }
          },
        }
      },
    }
  }
}

const makeEnv = async ({ rateLimitSuccess = true } = {}) => ({
  DB: new FakeDb(await hashPin('4827', new Uint8Array(16).fill(7))),
  LOGIN_RATE_LIMITER: { limit: async ({ key }) => ({ success: key === 'amor-e-sabor:auth-login' && rateLimitSuccess }) },
  ASSETS: { fetch: async () => new Response('asset') },
})

const mutationHeaders = (extra = {}) => ({ origin: 'https://delivery.example', 'content-type': 'application/json', ...extra })

const login = async (env, pin = '4827') => handleRequest(new Request('https://delivery.example/api/auth/login', {
  method: 'POST',
  headers: mutationHeaders(),
  body: JSON.stringify({ pin }),
}), env)

test('session endpoint is unauthenticated without a cookie', async () => {
  const env = await makeEnv()
  const response = await handleRequest(new Request('https://delivery.example/api/auth/session'), env)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { authenticated: false })
})

test('invalid PIN is rejected without exposing credentials', async () => {
  const env = await makeEnv()
  const response = await login(env, '9999')
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: { code: 'INVALID_PIN', message: 'PIN inválido.' } })
})

test('valid PIN creates a cookie-only session', async () => {
  const env = await makeEnv()
  const response = await login(env)
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body, { authenticated: true, businessId: 'amor-e-sabor' })
  assert.equal('token' in body, false)
  const cookie = response.headers.get('set-cookie')
  assert.match(cookie, /^amor_session=/)
  assert.match(cookie, /HttpOnly/)

  const sessionResponse = await handleRequest(new Request('https://delivery.example/api/auth/session', {
    headers: { cookie: cookie.split(';')[0] },
  }), env)
  assert.deepEqual(await sessionResponse.json(), { authenticated: true, businessId: 'amor-e-sabor' })
})

test('business API route rejects requests without a valid session', async () => {
  const env = await makeEnv()
  const response = await handleRequest(new Request('https://delivery.example/api/bootstrap'), env)
  assert.equal(response.status, 401)
  assert.equal((await response.json()).error.code, 'UNAUTHENTICATED')
})

test('logout revokes the current session and clears the cookie', async () => {
  const env = await makeEnv()
  const loginResponse = await login(env)
  const cookiePair = loginResponse.headers.get('set-cookie').split(';')[0]
  const response = await handleRequest(new Request('https://delivery.example/api/auth/logout', {
    method: 'POST',
    headers: mutationHeaders({ cookie: cookiePair }),
  }), env)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/)

  const sessionResponse = await handleRequest(new Request('https://delivery.example/api/auth/session', { headers: { cookie: cookiePair } }), env)
  assert.deepEqual(await sessionResponse.json(), { authenticated: false })
})

test('login is rate limited before PIN verification', async () => {
  const env = await makeEnv({ rateLimitSuccess: false })
  const response = await login(env)
  assert.equal(response.status, 429)
  assert.equal((await response.json()).error.code, 'LOGIN_RATE_LIMITED')
  assert.equal(env.DB.sessions.length, 0)
})

test('mutations reject a missing or cross-origin Origin header', async () => {
  const env = await makeEnv()
  const response = await handleRequest(new Request('https://delivery.example/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '4827' }),
  }), env)
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error.code, 'ORIGIN_NOT_ALLOWED')
})

test('authenticated bootstrap returns the shared clean business dataset', async () => {
  const env = await makeEnv()
  env.DB.tables.set('table-2', { id: 'table-2', business_id: 'amor-e-sabor', name: 'Mesa 2', sort_order: 2, is_active: 1 })
  env.DB.tables.set('table-1', { id: 'table-1', business_id: 'amor-e-sabor', name: 'Mesa 1', sort_order: 1, is_active: 1 })
  env.DB.tableTabs.set('tab-1', {
    id: 'tab-1', business_id: 'amor-e-sabor', table_id: 'table-2', table_identifier: 'Mesa 2', status: 'open',
    tab_number: 1042, opened_at: '2026-09-07T12:00:00.000Z', closed_at: null,
  })
  const loginResponse = await login(env)
  const cookiePair = loginResponse.headers.get('set-cookie').split(';')[0]
  const response = await handleRequest(new Request('https://delivery.example/api/bootstrap', {
    headers: { cookie: cookiePair },
  }), env)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    business: { id: 'amor-e-sabor', name: 'Amor & Sabor' },
    clients: [],
    products: [],
    orders: [],
    tables: [
      { id: 'table-1', name: 'Mesa 1', sortOrder: 1, isActive: true, occupancy: 'free', openTableTabId: null, openTableTab: null },
      {
        id: 'table-2', name: 'Mesa 2', sortOrder: 2, isActive: true, occupancy: 'occupied', openTableTabId: 'tab-1',
        openTableTab: { id: 'tab-1', number: 1042, openedAt: '2026-09-07T12:00:00.000Z', orderCount: 0, itemCount: 0, totalCents: 0 },
      },
    ],
    tableTabs: [{
      id: 'tab-1', tableId: 'table-2', tableIdentifier: 'Mesa 2', tabNumber: 1042, status: 'open',
      openedAt: '2026-09-07T12:00:00.000Z', closedAt: null,
    }],
    movements: [],
    financeSettings: null,
  })
})

test('authenticated client CRUD validates and uses the session business', async () => {
  const env = await makeEnv()
  const loginResponse = await login(env)
  const cookiePair = loginResponse.headers.get('set-cookie').split(';')[0]
  const headers = mutationHeaders({ cookie: cookiePair })

  const createResponse = await handleRequest(new Request('https://delivery.example/api/clients', {
    method: 'POST', headers, body: JSON.stringify({ name: '  Maria  ', phone: '11', address: 'Centro' }),
  }), env)
  assert.equal(createResponse.status, 201)
  const created = (await createResponse.json()).client
  assert.equal(created.name, 'Maria')
  assert.equal(env.DB.clients.get(created.id).business_id, 'amor-e-sabor')

  const patchResponse = await handleRequest(new Request(`https://delivery.example/api/clients/${created.id}`, {
    method: 'PATCH', headers, body: JSON.stringify({ name: 'Maria Silva', phone: '22', address: 'Bairro' }),
  }), env)
  assert.equal((await patchResponse.json()).client.name, 'Maria Silva')

  const deleteResponse = await handleRequest(new Request(`https://delivery.example/api/clients/${created.id}`, {
    method: 'DELETE', headers,
  }), env)
  assert.equal(deleteResponse.status, 200)
  assert.equal(env.DB.clients.has(created.id), false)
})

test('authenticated product CRUD converts money to cents and soft deletes', async () => {
  const env = await makeEnv()
  const loginResponse = await login(env)
  const cookiePair = loginResponse.headers.get('set-cookie').split(';')[0]
  const headers = mutationHeaders({ cookie: cookiePair })

  const createResponse = await handleRequest(new Request('https://delivery.example/api/products', {
    method: 'POST', headers, body: JSON.stringify({ category: 'Bebida', size: '350ml', name: 'Coca', price: 8.5 }),
  }), env)
  assert.equal(createResponse.status, 201)
  const product = (await createResponse.json()).product
  assert.equal(product.price, 8.5)
  assert.equal(env.DB.products.get(product.id).price_cents, 850)

  const deleteResponse = await handleRequest(new Request(`https://delivery.example/api/products/${product.id}`, {
    method: 'DELETE', headers,
  }), env)
  assert.equal(deleteResponse.status, 200)
  assert.equal(env.DB.products.get(product.id).active, 0)
})

test('client and product routes return 404 for records outside the session business', async () => {
  const env = await makeEnv()
  env.DB.clients.set('other-client', { id: 'other-client', business_id: 'other', name: 'X' })
  const loginResponse = await login(env)
  const cookiePair = loginResponse.headers.get('set-cookie').split(';')[0]
  const response = await handleRequest(new Request('https://delivery.example/api/clients/other-client', {
    method: 'PATCH', headers: mutationHeaders({ cookie: cookiePair }), body: JSON.stringify({ name: 'No', phone: '', address: '' }),
  }), env)
  assert.equal(response.status, 404)
  assert.equal((await response.json()).error.code, 'CLIENT_NOT_FOUND')
})

const paymentPromiseOrder = (overrides = {}) => ({
  id: 'order-promise', business_id: 'amor-e-sabor', client_id: 'c1', client_name_snapshot: 'Maria', client_phone_snapshot: '', client_address_snapshot: '',
  customer_identity_type: 'registered_client', table_tab_id: null, type: 'Entrega', order_date: '2026-09-06', status: 'Finalizado', scheduled_for: null,
  promised_payment_date: null, is_backdated: 0, subtotal_cents: 5000, delivery_fee_cents: 0, adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0,
  adjustment_amount_cents: 0, adjustment_reason: '', total_cents: 5000, created_at: '2026-09-06T12:00:00.000Z', finished_at: null, cancelled_at: null,
  payment_id: null, payment_method: null, paid_at: null, paid_amount_cents: null, refund_movement_id: null, refund_created_at: null, ...overrides,
})

test('payment-promise PATCH updates an in-business order and rejects invalid, past, and outside-business orders', async () => {
  const env = await makeEnv()
  env.DB.orders.set('order-promise', paymentPromiseOrder())
  env.DB.orders.set('other-order', paymentPromiseOrder({ id: 'other-order', business_id: 'other-business' }))
  const loginResponse = await login(env)
  const headers = mutationHeaders({ cookie: loginResponse.headers.get('set-cookie').split(';')[0] })
  const request = (id, promisedPaymentDate) => handleRequest(new Request(`https://delivery.example/api/orders/${id}/payment-promise`, {
    method: 'PATCH', headers, body: JSON.stringify({ promisedPaymentDate }),
  }), env)

  const success = await request('order-promise', '2099-12-31')
  assert.equal(success.status, 200)
  assert.equal((await success.json()).order.promisedPaymentDate, '2099-12-31')
  const invalid = await request('order-promise', '2026-02-31')
  assert.equal(invalid.status, 400)
  assert.equal((await invalid.json()).error.code, 'INVALID_PROMISED_PAYMENT_DATE')
  const past = await request('order-promise', '2000-01-01')
  assert.equal(past.status, 400)
  assert.equal((await past.json()).error.code, 'PROMISED_PAYMENT_DATE_IN_PAST')
  const outsideBusiness = await request('other-order', '2099-12-31')
  assert.equal(outsideBusiness.status, 404)
  assert.equal((await outsideBusiness.json()).error.code, 'ORDER_NOT_FOUND')
})
