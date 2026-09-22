import assert from 'node:assert/strict'
import test from 'node:test'
import { createSession, sessionCookie } from './auth.js'
import { handleRequest } from './index.js'
import { createSettingsDb } from './test-support/settingsDb.js'

const origin = 'https://delivery.example'
const mutation = (path, cookie, body) => new Request(`${origin}${path}`, {
  method: 'POST',
  headers: { origin, cookie, 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

test('real HTTP flow keeps the TV cookie out of every administrative boundary and revocation is definitive', async (t) => {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  const env = {
    DB: fixture.db,
    resolveCapabilities: async () => new Set(['orders.settings.manage']),
  }
  const { token: adminToken } = await createSession(env, 'amor-e-sabor', new Date('2026-09-22T18:00:00.000Z'))
  const adminCookie = sessionCookie(adminToken).split(';')[0]

  const access = await handleRequest(mutation('/api/kitchen-tv/access', adminCookie), env)
  assert.equal(access.status, 201)
  const pairingToken = new URLSearchParams(new URL((await access.json()).pairingUrl).hash.slice(1)).get('token')
  const pair = await handleRequest(mutation('/api/kitchen-tv/pair', '', { token: pairingToken }), env)
  assert.equal(pair.status, 200)
  const tvCookie = pair.headers.get('set-cookie').split(';')[0]

  assert.equal((await handleRequest(new Request(`${origin}/api/kitchen-tv/state`, { headers: { cookie: tvCookie } }), env)).status, 200)
  assert.equal((await handleRequest(new Request(`${origin}/api/kitchen-tv/state`, { headers: { cookie: adminCookie } }), env)).status, 401)
  for (const path of ['/api/bootstrap', '/api/orders', '/api/printing/settings', '/api/settings/operations']) {
    assert.equal((await handleRequest(new Request(`${origin}${path}`, { headers: { cookie: tvCookie } }), env)).status, 401, path)
  }

  assert.equal((await handleRequest(mutation('/api/kitchen-tv/revoke', adminCookie), env)).status, 200)
  assert.equal((await handleRequest(new Request(`${origin}/api/kitchen-tv/state`, { headers: { cookie: tvCookie } }), env)).status, 401)
})
