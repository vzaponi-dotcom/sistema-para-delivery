import assert from 'node:assert/strict'
import test from 'node:test'
import { createSession, sessionCookie } from './auth.js'
import { handleRequest } from './index.js'
import { createSettingsDb } from './test-support/settingsDb.js'

const origin = 'https://delivery.example'
const mutation = (path, cookie, body) => new Request(`${origin}${path}`, {
  method: 'POST',
  headers: { origin, ...(cookie ? { cookie } : {}), 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

test('real code-pairing flow keeps temporary and final TV cookies outside administrative boundaries', async (t) => {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  const env = { DB: fixture.db, resolveCapabilities: async () => new Set(['orders.settings.manage', 'orders.view']) }
  const { token: adminToken } = await createSession(env, 'amor-e-sabor', new Date())
  const adminCookie = sessionCookie(adminToken).split(';')[0]

  const requestPair = await handleRequest(mutation('/api/kitchen-tv/pairing-request', ''), env)
  assert.equal(requestPair.status, 201)
  const { code } = await requestPair.json()
  const pairingCookie = requestPair.headers.get('set-cookie').split(';')[0]

  assert.equal((await handleRequest(mutation('/api/kitchen-tv/approve', adminCookie, { code }), env)).status, 200)
  const activate = await handleRequest(new Request(`${origin}/api/kitchen-tv/pairing-status`, { headers: { cookie: pairingCookie } }), env)
  assert.equal(activate.status, 200)
  const tvMatch = activate.headers.get('set-cookie').match(/kitchen_tv_session=([^;,]+)/)
  assert.ok(tvMatch)
  const tvCookie = `kitchen_tv_session=${tvMatch[1]}`

  assert.equal((await handleRequest(new Request(`${origin}/api/kitchen-tv/state`, { headers: { cookie: tvCookie } }), env)).status, 200)
  assert.equal((await handleRequest(new Request(`${origin}/api/kitchen-tv/state`, { headers: { cookie: adminCookie } }), env)).status, 401)
  for (const path of ['/api/bootstrap', '/api/orders', '/api/printing/settings', '/api/settings/operations']) {
    assert.equal((await handleRequest(new Request(`${origin}${path}`, { headers: { cookie: tvCookie } }), env)).status, 401, path)
  }
  for (const [method,path] of [
    ['GET','/api/printing/jobs'],['GET','/api/printing/qz/certificate'],['GET','/api/orders/control-order/print-document'],
    ['POST','/api/printing/qz/sign'],['POST','/api/printing/jobs/claim-next'],['POST','/api/printing/jobs/claim-recovery-next'],
    ['POST','/api/printing/jobs/job1/retry'],['POST','/api/printing/jobs/job1/resolve-outcome'],['POST','/api/printing/stations/s1/recovery'],
  ]) {
    const request = method==='GET' ? new Request(`${origin}${path}`,{headers:{cookie:tvCookie}}) : mutation(path,tvCookie,{stationId:'s1'})
    assert.equal((await handleRequest(request,env)).status,401,`${method} ${path}`)
  }

  assert.equal((await handleRequest(mutation('/api/kitchen-tv/revoke', adminCookie), env)).status, 200)
  assert.equal((await handleRequest(new Request(`${origin}/api/kitchen-tv/state`, { headers: { cookie: tvCookie } }), env)).status, 401)
  assert.equal((await handleRequest(new Request(`${origin}/api/kitchen-tv/report`, {
    method: 'POST',
    headers: { origin, cookie: tvCookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      appliedRevision: 0,
      currentPage: 1,
      pageCount: 1,
      viewportWidth: 960,
      viewportHeight: 540,
      visibleOrderIds: [],
    }),
  }), env)).status, 401)
  const revokedControl = await handleRequest(new Request(`${origin}/api/kitchen-tv/control`, {
    headers: { cookie: adminCookie },
  }), env)
  assert.equal(revokedControl.status, 200)
  assert.equal((await revokedControl.json()).paired, false)
})


test('TV telemetry and administrative control remain on opposite authentication boundaries', async (t) => {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  const env = {
    DB: fixture.db,
    resolveCapabilities: async () => new Set([
      'orders.view',
      'orders.kitchen.control',
      'orders.settings.manage',
    ]),
  }
  const { token: adminToken } = await createSession(env, 'amor-e-sabor', new Date())
  const adminCookie = sessionCookie(adminToken).split(';')[0]

  const pair = await handleRequest(mutation('/api/kitchen-tv/pairing-request', ''), env)
  const { code } = await pair.json()
  const pairingCookie = pair.headers.get('set-cookie').split(';')[0]
  assert.equal((await handleRequest(mutation('/api/kitchen-tv/approve', adminCookie, { code }), env)).status, 200)

  const activated = await handleRequest(new Request(`${origin}/api/kitchen-tv/pairing-status`, {
    headers: { cookie: pairingCookie },
  }), env)
  const tvToken = activated.headers.get('set-cookie').match(/kitchen_tv_session=([^;,]+)/)?.[1]
  assert.ok(tvToken)
  const tvCookie = `kitchen_tv_session=${tvToken}`

  const adminControl = await handleRequest(new Request(`${origin}/api/kitchen-tv/control`, {
    headers: { cookie: adminCookie },
  }), env)
  assert.equal(adminControl.status, 200)

  const tvAdminMutation = await handleRequest(new Request(`${origin}/api/kitchen-tv/control/page`, {
    method: 'PATCH',
    headers: { origin, cookie: tvCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ page: 2 }),
  }), env)
  assert.equal(tvAdminMutation.status, 401)

  const adminSpoofedReport = await handleRequest(new Request(`${origin}/api/kitchen-tv/report`, {
    method: 'POST',
    headers: { origin, cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      appliedRevision: 0,
      currentPage: 1,
      pageCount: 1,
      viewportWidth: 960,
      viewportHeight: 540,
      visibleOrderIds: [],
    }),
  }), env)
  assert.equal(adminSpoofedReport.status, 401)

  const tvReport = await handleRequest(new Request(`${origin}/api/kitchen-tv/report`, {
    method: 'POST',
    headers: { origin, cookie: tvCookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      appliedRevision: 0,
      currentPage: 1,
      pageCount: 1,
      viewportWidth: 960,
      viewportHeight: 540,
      visibleOrderIds: [],
    }),
  }), env)
  assert.equal(tvReport.status, 200)
})


const apiMutation = (path, cookie, method = 'POST', body) => new Request(`${origin}${path}`, {
  method,
  headers: { origin, ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

function insertPreparingControlOrder(sqlite, id = 'control-order') {
  sqlite.prepare(`INSERT INTO orders (
    id, business_id, client_name_snapshot, type, order_date, status,
    subtotal_cents, total_cents, created_at, finished_at, scheduled_for,
    cancelled_at, order_number
  ) VALUES (?, 'amor-e-sabor', 'Cliente controle', 'Entrega', '2026-09-28', 'Em preparo',
    1000, 1000, '2026-09-28T20:00:00.000Z', NULL, NULL, NULL, 901)`)
    .run(id)
}

test('kitchen control capability never grants official finalization and terminal finalize cleans hidden state', async (t) => {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  insertPreparingControlOrder(fixture.sqlite)
  let grants = new Set(['orders.settings.manage', 'orders.view'])
  const env = { DB: fixture.db, resolveCapabilities: async () => grants }
  const { token: adminToken } = await createSession(env, 'amor-e-sabor', new Date())
  const adminCookie = sessionCookie(adminToken).split(';')[0]

  const pair = await handleRequest(mutation('/api/kitchen-tv/pairing-request', ''), env)
  const { code } = await pair.json()
  const pairingCookie = pair.headers.get('set-cookie').split(';')[0]
  assert.equal((await handleRequest(mutation('/api/kitchen-tv/approve', adminCookie, { code }), env)).status, 200)
  const activated = await handleRequest(new Request(`${origin}/api/kitchen-tv/pairing-status`, {
    headers: { cookie: pairingCookie },
  }), env)
  assert.equal(activated.status, 200)

  grants = new Set(['orders.view', 'orders.kitchen.control'])
  assert.equal((await handleRequest(apiMutation('/api/kitchen-tv/control/page', adminCookie, 'PATCH', { page: 2 }), env)).status, 200)
  assert.equal((await handleRequest(apiMutation('/api/kitchen-tv/control/orders/control-order/hidden', adminCookie, 'PUT'), env)).status, 200)
  assert.equal((await handleRequest(apiMutation('/api/orders/control-order/status', adminCookie, 'PATCH', { status: 'Finalizado' }), env)).status, 403)

  grants = new Set(['orders.view', 'orders.history', 'orders.finalize'])
  assert.equal((await handleRequest(apiMutation('/api/kitchen-tv/control/page', adminCookie, 'PATCH', { page: 3 }), env)).status, 403)
  const finalized = await handleRequest(apiMutation('/api/orders/control-order/status', adminCookie, 'PATCH', { status: 'Finalizado' }), env)
  assert.equal(finalized.status, 200)
  const order = (await finalized.json()).order
  assert.equal(order.status, 'Finalizado')
  assert.ok(order.finishedAt)

  const control = await handleRequest(new Request(`${origin}/api/kitchen-tv/control`, {
    headers: { cookie: adminCookie },
  }), env)
  assert.equal(control.status, 200)
  assert.deepEqual((await control.json()).hiddenOrderIds, [])
  assert.equal(fixture.sqlite.prepare("SELECT count(*) AS n FROM kitchen_tv_hidden_orders WHERE order_id='control-order'").get().n, 0)

  grants = new Set(['orders.settings.manage'])
  assert.equal((await handleRequest(apiMutation('/api/kitchen-tv/control/page', adminCookie, 'PATCH', { page: 2 }), env)).status, 403)
})

test('Kitchen TV state payload never exposes administrative or private order fields', async (t) => {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  insertPreparingControlOrder(fixture.sqlite, 'privacy-order')
  const env = { DB: fixture.db, resolveCapabilities: async () => new Set(['orders.settings.manage']) }
  const { token: adminToken } = await createSession(env, 'amor-e-sabor', new Date())
  const adminCookie = sessionCookie(adminToken).split(';')[0]

  const pair = await handleRequest(mutation('/api/kitchen-tv/pairing-request', ''), env)
  const { code } = await pair.json()
  const pairingCookie = pair.headers.get('set-cookie').split(';')[0]
  assert.equal((await handleRequest(mutation('/api/kitchen-tv/approve', adminCookie, { code }), env)).status, 200)
  const activated = await handleRequest(new Request(`${origin}/api/kitchen-tv/pairing-status`, {
    headers: { cookie: pairingCookie },
  }), env)
  const tvToken = activated.headers.get('set-cookie').match(/kitchen_tv_session=([^;,]+)/)?.[1]
  assert.ok(tvToken)

  const response = await handleRequest(new Request(`${origin}/api/kitchen-tv/state`, {
    headers: { cookie: `kitchen_tv_session=${tvToken}` },
  }), env)
  assert.equal(response.status, 200)
  const payload = await response.json()
  const serialized = JSON.stringify(payload)
  for (const forbidden of ['phone', 'address', 'payment', 'total', 'pin', 'settingsContextId', 'capabilities']) {
    assert.doesNotMatch(serialized, new RegExp(forbidden, 'i'), forbidden)
  }
  assert.equal(payload.orders[0].id, 'privacy-order')
})
