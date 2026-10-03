import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { seedTenantResources } from '../test-support/tenantResources.js'
import { prepareAccountSession } from '../identity/sessions.js'
import { commitIdentityStatements } from '../identity/transactions.js'
import { handleRequest } from '../index.js'
import { activateKitchenTvApprovedRequest } from '../kitchenTvRepository.js'
import { sha256Hex } from '../auth.js'

const origin = 'https://example.test'
const req = (path, { session, cookie = '', method = 'GET', body, marker } = {}) => new Request(`${origin}${path}`, { method, headers: { origin, cookie: [cookie, session ? `mesiva_session=${session.token}` : ''].filter(Boolean).join('; '), 'content-type': 'application/json', ...(session ? { 'X-Mesiva-Context': marker || session.contextId } : {}) }, ...(method !== 'GET' ? { body: JSON.stringify(body || {}) } : {}) })
async function setup(t) {
  const f = await createTenancyFixture(t), sessions = {}
  const a = seedTenantResources(f.sqlite, f.businesses.A, 'A'), b = seedTenantResources(f.sqlite, f.businesses.B, 'B')
  for (const [key, accountId, businessId] of [['A', f.accounts.alice, f.businesses.A], ['B', f.accounts.carol, f.businesses.B]]) {
    const prepared = await prepareAccountSession(f.db, { accountId, businessId, expectedCredentialRevision: 1, scope: 'business' })
    await commitIdentityStatements(f.db, prepared.statements); sessions[key] = prepared.value
  }
  return { ...f, a, b, sessions, env: { DB: f.db, AUTH_MULTI_COMPANY_ENABLED: 'true' } }
}
async function pair(f, session) {
  const create = await handleRequest(req('/api/kitchen-tv/pairing-request', { method: 'POST' }), f.env)
  assert.equal(create.status, 201)
  const body = await create.json(), cookie = create.headers.get('set-cookie').split(';')[0]
  assert.equal((await handleRequest(req('/api/kitchen-tv/approve', { method: 'POST', session, body: { code: body.code } }), f.env)).status, 200)
  const activated = await handleRequest(req('/api/kitchen-tv/pairing-status', { cookie }), f.env)
  assert.equal(activated.status, 200)
  return activated.headers.get('set-cookie').match(/kitchen_tv_session=[^;,]+/)[0]
}

test('two paired TVs keep their company after human context switching and never grant human administration', async t => {
  const f = await setup(t), tvA = await pair(f, f.sessions.A), tvB = await pair(f, f.sessions.B)
  const switched = await handleRequest(req('/api/auth/select-business', { session: f.sessions.A, method: 'POST', body: { businessId: f.businesses.B } }), f.env)
  assert.equal(switched.status, 200)
  const newHumanCookie = switched.headers.get('set-cookie').split(';')[0]
  for (const [key, cookie] of [['A', tvA], ['B', tvB]]) {
    const response = await handleRequest(req('/api/kitchen-tv/state', { cookie: `${cookie}; ${newHumanCookie}` }), f.env)
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.deepEqual(data.orders.map(order => order.id), [`order-${key}`])
    assert.equal(JSON.stringify(data).includes(`Private client ${key === 'A' ? 'B' : 'A'}`), false)
  }
  assert.equal((await handleRequest(req('/api/kitchen-tv/state', { cookie: newHumanCookie }), f.env)).status, 401)
  for (const path of ['/api/bootstrap', '/api/access/users', '/api/platform/businesses']) assert.equal((await handleRequest(req(path, { cookie: tvA }), f.env)).status, 401, path)
})

test('a pairing code already approved for B cannot disturb A pending approval', async t => {
  const f = await setup(t), pending = []
  for (const key of ['A', 'B']) {
    const response = await handleRequest(req('/api/kitchen-tv/pairing-request', { method: 'POST' }), f.env), body = await response.json()
    pending.push(body)
    assert.equal((await handleRequest(req('/api/kitchen-tv/approve', { session: f.sessions[key], method: 'POST', body: { code: body.code } }), f.env)).status, 200)
  }
  const before = f.sqlite.prepare('SELECT * FROM kitchen_tv_pairing_requests WHERE approved_business_id = ?').get(f.businesses.A)
  assert.equal((await handleRequest(req('/api/kitchen-tv/approve', { session: f.sessions.A, method: 'POST', body: { code: pending[1].code } }), f.env)).status, 404)
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM kitchen_tv_pairing_requests WHERE approved_business_id = ?').get(f.businesses.A), before)
})

test('concurrent TV activation cannot rotate the winner token when the loser uses the same timestamp', async t => {
  const f = await setup(t), now = new Date(), requestHash = 'synthetic-pairing-hash'
  f.sqlite.prepare('INSERT INTO kitchen_tv_pairing_requests(request_token_hash,pairing_code,approved_business_id,expires_at,created_at,approved_at) VALUES(?,?,?,?,?,?)').run(requestHash, '123456', f.businesses.A, new Date(now.getTime() + 60_000).toISOString(), now.toISOString(), now.toISOString())
  const results = await Promise.all([activateKitchenTvApprovedRequest(f.db, requestHash, 'winner-hash', now), activateKitchenTvApprovedRequest(f.db, requestHash, 'loser-hash', now)])
  assert.equal(results.filter(Boolean).length, 1)
  assert.equal(f.sqlite.prepare('SELECT session_token_hash FROM kitchen_tv_access WHERE business_id = ?').get(f.businesses.A).session_token_hash, 'winner-hash')
})

test('printing documents, queue, attempts, station claims and confirmation cannot cross company boundaries', async t => {
  const f = await setup(t), before = f.sqlite.prepare('SELECT * FROM print_jobs WHERE business_id = ?').all(f.businesses.B)
  const cases = [
    ['GET', '/api/orders/order-B/print-document'], ['GET', '/api/table-tabs/tab-B/print-document'],
    ['POST', '/api/orders/order-B/print-jobs', { copies: 1 }], ['POST', '/api/table-tabs/tab-B/print-jobs', { copies: 1 }],
    ['POST', '/api/printing/jobs/job-B/claim', { stationId: f.a.station }], ['POST', '/api/printing/jobs/job-A/claim', { stationId: f.b.station }],
    ['POST', '/api/printing/jobs/job-B/complete', { stationId: f.a.station, copiesPrinted: 1 }],
    ['POST', '/api/printing/jobs/job-B/reprint', { copies: 1 }], ['POST', '/api/printing/jobs/job-B/attempts', { stationId: f.a.station, copyNumber: 1 }],
    ['POST', '/api/printing/attempts/attempt-B/submitting', { stationId: f.a.station }], ['POST', '/api/printing/attempts/attempt-A/submitting', { stationId: f.b.station }],
    ['POST', '/api/printing/stations/station-B/recovery', { state: 'normal' }],
  ]
  for (const [method, path, body] of cases) {
    const response = await handleRequest(req(path, { session: f.sessions.A, method, body }), f.env)
    assert.equal(response.status, 404, `${method} ${path}: ${await response.clone().text()}`)
  }
  const queue = await (await handleRequest(req('/api/printing/jobs', { session: f.sessions.A }), f.env)).json()
  assert.equal(JSON.stringify(queue).includes('job-B'), false)
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM print_jobs WHERE business_id = ?').all(f.businesses.B), before)
})

test('global QZ signing verifies the raw request hash and authorizes its company-owned physical attempt', async t => {
  const f = await setup(t)
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-512' }, true, ['sign', 'verify'])
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  f.env.QZ_SIGNING_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----`
  const payload = name => JSON.stringify({ call: 'print', params: { options: { jobName: name }, data: [] }, timestamp: Date.now() })
  const foreign = payload('spool-B')
  const denied = await handleRequest(req('/api/printing/qz/sign', { session: f.sessions.A, method: 'POST', body: { toSign: await sha256Hex(foreign), payload: foreign } }), f.env)
  assert.equal(denied.status, 404)
  f.sqlite.prepare("UPDATE print_jobs SET status = 'awaiting_confirmation',station_id = ? WHERE id = ?").run(f.a.station, f.a.job)
  f.sqlite.prepare("UPDATE print_job_attempts SET status = 'submitting',submission_started_at = ? WHERE id = ?").run(new Date().toISOString(), f.a.attempt)
  const own = payload('spool-A'), hash = await sha256Hex(own)
  const signed = await handleRequest(req('/api/printing/qz/sign', { session: f.sessions.A, method: 'POST', body: { toSign: hash, payload: own } }), f.env)
  assert.equal(signed.status, 200, await signed.clone().text())
  const signature = Uint8Array.from(atob(await signed.text()), c => c.charCodeAt(0))
  assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey, signature, new TextEncoder().encode(hash)), true)
  assert.equal((await handleRequest(req('/api/printing/qz/sign', { session: f.sessions.A, method: 'POST', body: { toSign: hash, payload: foreign } }), f.env)).status, 400)
  assert.equal((await handleRequest(req('/api/printing/qz/sign', { session: f.sessions.A, method: 'POST', body: { toSign: hash } }), f.env)).status, 400)
  for (const message of [{ call: 'file.read', params: { path: 'private' } }, { call: 'printers.startListening', params: { jobData: true } }]) {
    const raw = JSON.stringify({ ...message, timestamp: Date.now() })
    assert.equal((await handleRequest(req('/api/printing/qz/sign', { session: f.sessions.A, method: 'POST', body: { payload: raw, toSign: await sha256Hex(raw) } }), f.env)).status, 403)
  }
  const discovery = JSON.stringify({ call: 'printers.find', params: {}, timestamp: Date.now() })
  assert.equal((await handleRequest(req('/api/printing/qz/sign', { session: f.sessions.A, method: 'POST', body: { payload: discovery, toSign: await sha256Hex(discovery) } }), f.env)).status, 200)
})
