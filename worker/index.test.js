import test, { afterEach } from 'node:test'
import { createSettingsDb } from './test-support/settingsDb.js'
import { APPLICATION_CAPABILITIES } from '../shared/settingsAccess.js'
import assert from 'node:assert/strict'
import { hashPin } from './auth.js'
import { handleRequest } from './index.js'

const fixtures=[]
afterEach(()=>{for(const close of fixtures.splice(0))close()})
const seedRow=(db,table,row)=>{
  const columns=new Set(db.sqlite.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name))
  const values=Object.entries({created_at:'2026-09-30',updated_at:'2026-09-30',...row}).filter(([k])=>columns.has(k))
  db.sqlite.prepare(`INSERT INTO ${table}(${values.map(([k])=>k).join(',')}) VALUES(${values.map(()=>'?').join(',')})`).run(...values.map(([,v])=>v))
}
const makeEnv = async ({ rateLimitSuccess = true, capabilities = [] } = {}) => {
  const fixture=createSettingsDb();fixtures.push(fixture.close)
  const DB={...fixture.db,sqlite:fixture.sqlite}
  DB.sqlite.prepare("INSERT INTO auth_credentials(business_id,pin_hash,created_at,updated_at) VALUES('amor-e-sabor',?,'2026-09-30','2026-09-30')").run(await hashPin('4827',new Uint8Array(16).fill(7)))
  for(const id of ['other','other-business'])seedRow(DB,'businesses',{id,slug:id,name:id})
  return {
    DB,
    LOGIN_RATE_LIMITER: { limit: async ({ key }) => ({ success: key === 'amor-e-sabor:auth-login' && rateLimitSuccess }) },
    ASSETS: { fetch: async () => new Response('asset') },
    resolveCapabilities: async () => new Set(capabilities),
  }
}

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
  assert.deepEqual(await response.json(), { authenticated: false, authMode: 'legacy' })
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
  const sessionBody = await sessionResponse.json()
  assert.equal(sessionBody.authenticated, true)
  assert.equal(sessionBody.businessId, 'amor-e-sabor')
  assert.deepEqual(sessionBody.capabilities, [])
  assert.match(sessionBody.settingsContextId, /^[0-9a-f]{24}$/)
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
  assert.deepEqual(await sessionResponse.json(), { authenticated: false, authMode: 'legacy' })
})

test('login is rate limited before PIN verification', async () => {
  const env = await makeEnv({ rateLimitSuccess: false })
  const response = await login(env)
  assert.equal(response.status, 429)
  assert.equal((await response.json()).error.code, 'LOGIN_RATE_LIMITED')
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM sessions').get().n, 0)
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

test('table transfer requires a non-empty string expectedTableTabId without mutating state', async () => {
  const env = await makeEnv({ capabilities: ['comandas.transfer'] })
  const loginResponse = await login(env)
  const headers = mutationHeaders({ cookie: loginResponse.headers.get('set-cookie').split(';')[0] })
  const before = env.DB.sqlite.prepare('SELECT * FROM table_tabs').all()

  for (const body of [
    {},
    { destinationTableId: 'destination' },
    { destinationTableId: 'destination', expectedTableTabId: '' },
    { destinationTableId: 'destination', expectedTableTabId: '   ' },
    { destinationTableId: 'destination', expectedTableTabId: 37 },
  ]) {
    const response = await handleRequest(new Request('https://delivery.example/api/tables/source/transfer', {
      method: 'POST', headers, body: JSON.stringify(body),
    }), env)
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error.code, 'EXPECTED_TABLE_TAB_REQUIRED')
  }
  assert.deepEqual(env.DB.sqlite.prepare('SELECT * FROM table_tabs').all(), before)
})

test('table transfer rejects an expected identity that is not the open tab at the source', async () => {
  const env = await makeEnv({ capabilities: ['comandas.transfer'] })
  const loginResponse = await login(env)
  const response = await handleRequest(new Request('https://delivery.example/api/tables/source/transfer', {
    method: 'POST',
    headers: mutationHeaders({ cookie: loginResponse.headers.get('set-cookie').split(';')[0] }),
    body: JSON.stringify({ destinationTableId: 'destination', expectedTableTabId: 'closed-A' }),
  }), env)

  assert.equal(response.status, 409)
  assert.equal((await response.json()).error.code, 'TABLE_TAB_CHANGED')
})

test('table transfer requires a non-empty destination identity', async () => {
  const env = await makeEnv({ capabilities: ['comandas.transfer'] })
  const loginResponse = await login(env)
  const headers = mutationHeaders({ cookie: loginResponse.headers.get('set-cookie').split(';')[0] })

  for (const destinationTableId of [undefined, '', '   ', 2]) {
    const response = await handleRequest(new Request('https://delivery.example/api/tables/source/transfer', {
      method: 'POST', headers, body: JSON.stringify({ destinationTableId, expectedTableTabId: 'A' }),
    }), env)
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR')
  }
})

test('authenticated bootstrap returns the shared clean business dataset', async () => {
  const env = await makeEnv({capabilities:APPLICATION_CAPABILITIES})
  env.DB.sqlite.exec('DELETE FROM tables')
  seedRow(env.DB,'tables', { name_key:'mesa 2', id: 'table-2', business_id: 'amor-e-sabor', name: 'Mesa 2', sort_order: 2, is_active: 1 })
  seedRow(env.DB,'tables', { name_key:'mesa 1', id: 'table-1', business_id: 'amor-e-sabor', name: 'Mesa 1', sort_order: 1, is_active: 1 })
  seedRow(env.DB,'table_tabs', {
    id: 'tab-1', business_id: 'amor-e-sabor', table_id: 'table-2', table_identifier: 'Mesa 2', status: 'open',
    tab_number: 1042, opened_at: '2026-09-07T12:00:00.000Z', closed_at: null,
  })
  const loginResponse = await login(env)
  const cookiePair = loginResponse.headers.get('set-cookie').split(';')[0]
  const response = await handleRequest(new Request('https://delivery.example/api/bootstrap', {
    headers: { cookie: cookiePair },
  }), env)

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.match(body.effectiveBusinessConfig.version, /^v1-[0-9a-f]{24}$/)
  assert.deepEqual(body.effectiveBusinessConfig.revisions, {cancellationReasons:1,financeCategories:1,operations:1,paymentMethods:1,printingPolicy:1})
  const knownVersion = body.effectiveBusinessConfig.version
  assert.equal(body.effectiveConfigVersion, knownVersion)
  const { effectiveBusinessConfig, effectiveConfigVersion: _effectiveConfigVersion, ...legacy } = body
  assert.ok(effectiveBusinessConfig)
  assert.deepEqual(legacy, {
    business: { id: 'amor-e-sabor', name: 'Amor & Sabor', hasLogo: false, logoVersion: null },
    clients: [],
    products: [],
    orders: [],
    tables: [
      { id: 'table-1', name: 'Mesa 1', sortOrder: 1, isActive: true, occupancy: 'free', openTableTabId: null, openTableTab: null, nextReservation: null },
      {
        id: 'table-2', name: 'Mesa 2', sortOrder: 2, isActive: true, occupancy: 'occupied', openTableTabId: 'tab-1',
        openTableTab: { id: 'tab-1', number: 1042, openedAt: '2026-09-07T12:00:00.000Z', orderCount: 0, itemCount: 0, totalCents: 0 },
        nextReservation: null,
      },
    ],
    tableTabs: [{
      id: 'tab-1', tableId: 'table-2', tableIdentifier: 'Mesa 2', tabNumber: 1042, status: 'open',
      openedAt: '2026-09-07T12:00:00.000Z', closedAt: null,
    }],
    movements: [],
    financeSettings: null,
  })

  const unchangedResponse = await handleRequest(new Request(
    `https://delivery.example/api/bootstrap?knownEffectiveConfigVersion=${encodeURIComponent(knownVersion)}`,
    { headers: { cookie: cookiePair } },
  ), env)
  const unchanged = await unchangedResponse.json()
  assert.equal(unchanged.effectiveConfigVersion, knownVersion)
  assert.equal(Object.hasOwn(unchanged, 'effectiveBusinessConfig'), false)
  assert.deepEqual(unchanged.orders, [])

  const changedResponse = await handleRequest(new Request(
    'https://delivery.example/api/bootstrap?knownEffectiveConfigVersion=opaque-old',
    { headers: { cookie: cookiePair } },
  ), env)
  const changed = await changedResponse.json()
  assert.equal(changed.effectiveConfigVersion, knownVersion)
  assert.equal(changed.effectiveBusinessConfig.version, knownVersion)
})

test('authenticated client CRUD validates and uses the session business', async () => {
  const env = await makeEnv({ capabilities: ['clients.view', 'clients.create', 'clients.update', 'clients.delete'] })
  const loginResponse = await login(env)
  const cookiePair = loginResponse.headers.get('set-cookie').split(';')[0]
  const headers = mutationHeaders({ cookie: cookiePair })

  const createResponse = await handleRequest(new Request('https://delivery.example/api/clients', {
    method: 'POST', headers, body: JSON.stringify({ name: '  Maria  ', phone: '11', address: 'Centro' }),
  }), env)
  assert.equal(createResponse.status, 201)
  const created = (await createResponse.json()).client
  assert.equal(created.name, 'Maria')
  assert.equal(env.DB.sqlite.prepare('SELECT business_id FROM clients WHERE id=?').get(created.id).business_id, 'amor-e-sabor')

  const patchResponse = await handleRequest(new Request(`https://delivery.example/api/clients/${created.id}`, {
    method: 'PATCH', headers, body: JSON.stringify({ name: 'Maria Silva', phone: '22', address: 'Bairro' }),
  }), env)
  assert.equal((await patchResponse.json()).client.name, 'Maria Silva')

  const deleteResponse = await handleRequest(new Request(`https://delivery.example/api/clients/${created.id}`, {
    method: 'DELETE', headers,
  }), env)
  assert.equal(deleteResponse.status, 200)
  assert.equal(Boolean(env.DB.sqlite.prepare('SELECT id FROM clients WHERE id=?').get(created.id)), false)
})

test('authenticated product CRUD converts money to cents and soft deletes', async () => {
  const env = await makeEnv({ capabilities: ['products.view', 'products.manage'] })
  const loginResponse = await login(env)
  const cookiePair = loginResponse.headers.get('set-cookie').split(';')[0]
  const headers = mutationHeaders({ cookie: cookiePair })

  const createResponse = await handleRequest(new Request('https://delivery.example/api/products', {
    method: 'POST', headers, body: JSON.stringify({ category: 'Bebida', size: '350ml', name: 'Coca', price: 8.5 }),
  }), env)
  assert.equal(createResponse.status, 201)
  const product = (await createResponse.json()).product
  assert.equal(product.price, 8.5)
  assert.equal(env.DB.sqlite.prepare('SELECT price_cents FROM products WHERE id=?').get(product.id).price_cents, 850)

  const deleteResponse = await handleRequest(new Request(`https://delivery.example/api/products/${product.id}`, {
    method: 'DELETE', headers,
  }), env)
  assert.equal(deleteResponse.status, 200)
  assert.equal(env.DB.sqlite.prepare('SELECT active FROM products WHERE id=?').get(product.id).active, 0)
})

test('client and product routes return 404 for records outside the session business', async () => {
  const env = await makeEnv({ capabilities: ['clients.update'] })
  seedRow(env.DB,'clients', { id: 'other-client', business_id: 'other', name: 'X' })
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
  const env = await makeEnv({ capabilities: ['finance.promises.manage','orders.history'] })
  seedRow(env.DB,'clients',{id:'c1',business_id:'amor-e-sabor',name:'Maria'})
  seedRow(env.DB,'orders',paymentPromiseOrder())
  seedRow(env.DB,'orders',paymentPromiseOrder({ id: 'other-order', business_id: 'other-business',client_id:null,customer_identity_type:'guest_name' }))
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


test('client receivables payment route validates order ids and allocations before writing', async () => {
  const env=await makeEnv({capabilities:['payments.receive','clients.view']})
  const loginResponse=await login(env)
  const headers=mutationHeaders({cookie:loginResponse.headers.get('set-cookie').split(';')[0]})
  for(const body of [{orderIds:[],allocations:[]},{orderIds:['order-1'],allocations:[]}]) {
    const response=await handleRequest(new Request('https://delivery.example/api/clients/client-1/receivables/payment',{method:'POST',headers,body:JSON.stringify(body)}),env)
    assert.equal(response.status,400)
  }
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM payment_receipts').get().n,0)
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) n FROM audit_events WHERE action='payment.received'").get().n,0)
})
