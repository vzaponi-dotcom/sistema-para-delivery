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
  const env = { DB: fixture.db, resolveCapabilities: async () => new Set(['orders.settings.manage']) }
  const { token: adminToken } = await createSession(env, 'amor-e-sabor', new Date('2026-09-22T18:00:00.000Z'))
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

  assert.equal((await handleRequest(mutation('/api/kitchen-tv/revoke', adminCookie), env)).status, 200)
  assert.equal((await handleRequest(new Request(`${origin}/api/kitchen-tv/state`, { headers: { cookie: tvCookie } }), env)).status, 401)
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
  const { token: adminToken } = await createSession(env, 'amor-e-sabor', new Date('2026-09-28T20:00:00.000Z'))
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
