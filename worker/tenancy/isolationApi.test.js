import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { seedTenantResources } from '../test-support/tenantResources.js'
import { prepareAccountSession } from '../identity/sessions.js'
import { commitIdentityStatements } from '../identity/transactions.js'
import { handleRequest } from '../index.js'
import { DEFAULT_OPERATIONS } from '../../shared/businessPolicies.js'
import { getBusinessDate } from '../../shared/finance.js'

async function setup(t) {
  const f = await createTenancyFixture(t)
  const a = seedTenantResources(f.sqlite, f.businesses.A, 'A'), b = seedTenantResources(f.sqlite, f.businesses.B, 'B')
  const sessions = {}
  for (const [key, accountId, scope, businessId] of [['A', f.accounts.alice, 'business', f.businesses.A], ['B', f.accounts.carol, 'business', f.businesses.B], ['identity', f.accounts.bob, 'identity', null], ['platform', f.accounts.admin, 'platform', null]]) {
    const prepared = await prepareAccountSession(f.db, { accountId, scope, businessId, expectedCredentialRevision: 1 })
    await commitIdentityStatements(f.db, prepared.statements)
    sessions[key] = prepared.value
  }
  return { ...f, a, b, sessions, env: { DB: f.db, AUTH_MULTI_COMPANY_ENABLED: 'true' } }
}
const request = (session, path, method = 'GET', body = {}, marker = session.contextId) => new Request(`https://example.test${path}`, { method, headers: { cookie: `mesiva_session=${session.token}`, origin: 'https://example.test', 'X-Mesiva-Context': marker, 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() }, ...(['GET', 'HEAD'].includes(method) ? {} : { body: JSON.stringify(body) }) })
const routes = [
  ['GET', '/api/bootstrap'], ['GET', '/api/orders'], ['GET', '/api/table-reservations'], ['GET', '/api/table-tabs/tab-B'], ['GET', '/api/reporting/overview'], ['GET', '/api/reporting/orders/order-B'],
  ['GET', '/api/settings/effective'], ['GET', '/api/settings/operations'], ['GET', '/api/settings/payment-methods'], ['GET', '/api/settings/cancellation-reasons'], ['GET', '/api/settings/finance-categories'], ['GET', '/api/settings/business-profile'], ['GET', '/api/settings/receipts/other?resource=operations'],
  ['GET', '/api/access/users'], ['GET', '/api/access/activity'], ['GET', '/api/business/logo'], ['GET', '/api/kitchen-tv/settings'], ['GET', '/api/printing/jobs'], ['GET', '/api/printing/stations'],
  ['POST', '/api/orders'], ['POST', '/api/clients'], ['PATCH', '/api/clients/client-B'], ['DELETE', '/api/products/product-B'], ['POST', '/api/orders/order-B/payment'], ['POST', '/api/orders/order-B/refund'], ['PUT', '/api/finance-settings'], ['PATCH', '/api/movements/movement-B'], ['PATCH', '/api/access/users/member-carol-B'], ['PUT', '/api/settings/operations'], ['POST', '/api/table-reservations/reservation-B/confirm-arrival'], ['POST', '/api/table-tabs/tab-B/payment'], ['POST', '/api/tables/table-B/transfer'],
  ['POST', '/api/tables'], ['PUT', '/api/tables/order'], ['PATCH', '/api/tables/table-B'], ['DELETE', '/api/clients/client-B'], ['POST', '/api/clients/client-B/receivables/payment'], ['PATCH', '/api/orders/order-B/status'], ['PATCH', '/api/orders/order-B/payment-promise'], ['POST', '/api/orders/order-B/cancel'],
  ['PUT', '/api/table-reservations/reservation-B'], ['POST', '/api/table-reservations/reservation-B/cancel'], ['POST', '/api/table-reservations/reservation-B/no-show'], ['POST', '/api/movements'], ['DELETE', '/api/movements/movement-B'], ['POST', '/api/products'], ['PATCH', '/api/products/product-B'],
  ['PUT', '/api/settings/payment-methods'], ['PUT', '/api/settings/cancellation-reasons'], ['PUT', '/api/settings/finance-categories'], ['PUT', '/api/settings/business-profile'], ['GET', '/api/reporting/operation'], ['GET', '/api/reporting/sales'], ['GET', '/api/reporting/products'], ['GET', '/api/reporting/orders'], ['POST', '/api/reporting/export-model'], ['POST', '/api/access/users'], ['POST', '/api/access/users/member-carol-B/resend-invite'], ['POST', '/api/access/users/member-carol-B/reset'],
]
test('every domain denies identity/platform scope and stale markers before operational reads or writes', async t => {
  const f = await setup(t)
  for (const [method, path] of routes) {
    for (const key of ['identity', 'platform']) assert.equal((await handleRequest(request(f.sessions[key], path, method), f.env)).status, 403, `${key} ${method} ${path}`)
    assert.equal((await handleRequest(request(f.sessions.A, path, method, {}, 'old-marker'), f.env)).status, 409, `${method} ${path}`)
  }
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM orders').get().n, 2)
})

test('foreign checkout relationships cannot create partial orders or move effects into another company', async t => {
  const f = await setup(t), today = getBusinessDate(new Date())
  const initialized = await handleRequest(request(f.sessions.A, '/api/settings/operations', 'PUT', { mutationId: 'initialize-checkout-policy', expectedRevision: 0, data: DEFAULT_OPERATIONS }), f.env)
  assert.equal(initialized.status, 200)
  const input = { type: 'Entrega', orderDate: today, clientId: f.a.client, items: [{ productId: f.a.product, quantity: 1 }] }
  for (const body of [{ ...input, clientId: f.b.client }, { ...input, items: [{ productId: f.b.product, quantity: 1 }] }, { ...input, type: 'Local', customerIdentity: { type: 'table', tableId: f.b.table } }]) {
    const response = await handleRequest(request(f.sessions.A, '/api/orders', 'POST', body), f.env)
    assert.equal(response.status, 404, await response.clone().text())
  }
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM orders').get().n, 2)
})

test('settings receipts, policy writes and reporting projection remain scoped with colliding receipt keys', async t => {
  const f = await setup(t), mutationId = 'shared-mutation-key'
  const bSaved = await handleRequest(request(f.sessions.B, '/api/settings/operations', 'PUT', { mutationId, expectedRevision: 0, data: DEFAULT_OPERATIONS }), f.env)
  assert.equal(bSaved.status, 200, await bSaved.clone().text())
  const receiptPath = `/api/settings/receipts/${mutationId}?resource=operations`
  assert.equal((await (await handleRequest(request(f.sessions.A, receiptPath), f.env)).json()).status, 'unconfirmed')
  assert.equal((await (await handleRequest(request(f.sessions.B, receiptPath), f.env)).json()).status, 'confirmed')
  const policy = { ...DEFAULT_OPERATIONS, timing: { ...DEFAULT_OPERATIONS.timing, immediateLateAfterMinutes: 32 } }
  const saved = await handleRequest(request(f.sessions.A, '/api/settings/operations', 'PUT', { mutationId, expectedRevision: 0, data: policy }), f.env)
  assert.equal(saved.status, 200, await saved.clone().text())
  const bPolicy = await (await handleRequest(request(f.sessions.B, '/api/settings/operations'), f.env)).json()
  assert.equal(bPolicy.data.timing.immediateLateAfterMinutes, DEFAULT_OPERATIONS.timing.immediateLateAfterMinutes)
  for (const endpoint of ['overview', 'operation', 'sales', 'products', 'orders']) {
    const response = await handleRequest(request(f.sessions.A, `/api/reporting/${endpoint}?period=custom&from=2026-10-02&to=2026-10-02`), f.env)
    assert.equal(response.status, 200, await response.clone().text())
    const content = await response.text()
    for (const foreign of ['Private client B', 'Private product B', 'order-B', 'Private movement B']) assert.equal(content.includes(foreign), false, endpoint)
  }
})
test('selected company controls bootstrap, list, configuration, team and audit projections; request tenant fields have no authority', async t => {
  const f = await setup(t)
  for (const key of ['A', 'B']) {
    const bootstrap = await handleRequest(request(f.sessions[key], '/api/bootstrap'), f.env)
    assert.equal(bootstrap.status, 200, await bootstrap.clone().text())
    const data = await bootstrap.json(), body = JSON.stringify(data)
    assert.equal(body.includes(`Private client ${key}`), true)
    assert.equal(body.includes(`Private client ${key === 'A' ? 'B' : 'A'}`), false)
    assert.equal((await handleRequest(request(f.sessions[key], '/api/access/users'), f.env)).status, 200)
    const profile = await handleRequest(request(f.sessions[key], '/api/settings/business-profile'), f.env)
    assert.equal(profile.status, 200)
    assert.equal((await profile.text()).includes(`Company ${key}`), true)
  }
  const created = await handleRequest(request(f.sessions.A, '/api/clients', 'POST', { name: 'Scoped new client', businessId: f.businesses.B, actorId: f.accounts.carol }), f.env)
  assert.equal(created.status, 201)
  const { client } = await created.json()
  assert.equal(f.sqlite.prepare('SELECT business_id FROM clients WHERE id = ?').get(client.id).business_id, f.businesses.A)
  assert.equal(f.sqlite.prepare('SELECT actor_user_id FROM audit_events WHERE resource_id = ?').get(client.id).actor_user_id, f.members.aliceA)
})
test('foreign resource reads and mutations never disclose or change company B', async t => {
  const f = await setup(t), allocations = [{ methodCode: 'pix', amountCents: 100 }]
  const cases = [
    ['PATCH', '/api/clients/client-B', { name: 'Changed' }], ['DELETE', '/api/clients/client-B', {}], ['PATCH', '/api/products/product-B', { category: 'Bebidas', name: 'Changed', price: 1 }], ['DELETE', '/api/products/product-B', {}],
    ['PATCH', '/api/tables/table-B', { name: 'Changed' }], ['PATCH', '/api/orders/order-B/status', { status: 'Finalizado' }], ['POST', '/api/orders/order-B/payment', { allocations }], ['PATCH', '/api/orders/order-B/payment-promise', { promisedPaymentDate: null }], ['POST', '/api/orders/order-B/cancel', { reason: 'client_changed_mind', expectedRevision: 0 }], ['POST', '/api/orders/order-B/refund', { refundMethod: 'Pix' }],
    ['GET', '/api/table-tabs/tab-B', {}], ['POST', '/api/table-tabs/tab-B/payment', { allocations }], ['GET', '/api/table-reservations/reservation-B', {}], ['POST', '/api/table-reservations/reservation-B/confirm-arrival', { expectedRevision: 1, mutationId: 'arrival' }],
    ['DELETE', '/api/movements/movement-B', {}], ['GET', '/api/reporting/orders/order-B', {}], ['PATCH', `/api/access/users/${f.members.carolB}`, { active: false }],
  ]
  const before = f.sqlite.prepare('SELECT * FROM orders WHERE business_id = ?').all(f.businesses.B)
  for (const [method, path, body] of cases) {
    const response = await handleRequest(request(f.sessions.A, path, method, body), f.env)
    assert.equal(response.status, 404, `${method} ${path}: ${await response.clone().text()}`)
    assert.equal((await response.text()).includes('Private client B'), false)
  }
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM orders WHERE business_id = ?').all(f.businesses.B), before)
})

test('logo download refuses a foreign R2 namespace before fetching bytes', async t => {
  const f = await setup(t), reads = []
  f.sqlite.prepare('INSERT INTO business_profiles(business_id,logo_object_key,logo_content_type,logo_sha256,logo_size_bytes,logo_updated_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(f.businesses.A, `businesses/${f.businesses.B}/logo/private.png`, 'image/png', 'a'.repeat(64), 8, f.now.toISOString(), f.now.toISOString(), f.now.toISOString())
  const env = { ...f.env, BUSINESS_ASSETS: { get: async key => { reads.push(key); return { body: new Uint8Array([1, 2, 3]), httpMetadata: { contentType: 'image/png' } } } } }
  const denied = await handleRequest(request(f.sessions.A, '/api/business/logo'), env)
  assert.equal(denied.status, 403)
  assert.equal(reads.length, 0)
  f.sqlite.prepare('UPDATE business_profiles SET logo_object_key = ? WHERE business_id = ?').run(`businesses/${f.businesses.A}/logo/own.png`, f.businesses.A)
  const allowed = await handleRequest(request(f.sessions.A, '/api/business/logo'), env)
  assert.equal(allowed.status, 200)
  assert.equal(reads[0], `businesses/${f.businesses.A}/logo/own.png`)
})
test('global cutover never accepts legacy PIN or company token endpoints as an alternate authentication path', async t => {
  const f = await setup(t)
  const pin = await handleRequest(request(f.sessions.A, '/api/auth/login', 'POST', { pin: 'synthetic-pin' }), f.env)
  assert.notEqual(pin.status, 200)
  assert.equal((await handleRequest(request(f.sessions.A, '/api/access/invitations/accept', 'POST', { token: 'synthetic' }), f.env)).status, 404)
  const state = await handleRequest(request(f.sessions.identity, '/api/auth/session'), f.env)
  const session = await state.json()
  assert.equal(session.authMode, 'multi_company')
  assert.equal(session.scope, 'identity')
  assert.equal('businessId' in session, false)
})
