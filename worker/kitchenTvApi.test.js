import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveSettingsAccess } from './settingsAccess.js'
import { createSettingsDb } from './test-support/settingsDb.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-22T18:00:00.000Z')
const apiPromise = import('./kitchenTvApi.js').catch(() => ({}))

const request = (path, method = 'GET', body, cookie, withOrigin = true) => new Request(`https://delivery.example${path}`, {
  method,
  headers: {
    ...(withOrigin ? { origin: 'https://delivery.example' } : {}),
    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(cookie ? { cookie } : {}),
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

function setup(t) {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  return fixture
}

const manager = () => resolveSettingsAccess({ businessId: BUSINESS, sessionId: 'manager' }, new Set(['orders.settings.manage']))
const reader = () => resolveSettingsAccess({ businessId: BUSINESS, sessionId: 'reader' }, new Set(['orders.settings.view']))

test('TV creates a short code, admin approves it, and TV receives its restricted session', async (t) => {
  const api = await apiPromise
  const { db } = setup(t)
  const env = { DB: db }

  const created = await api.handleKitchenTvPublicApi(request('/api/kitchen-tv/pairing-request', 'POST'), env, undefined, NOW)
  assert.equal(created.status, 201)
  const pairing = await created.json()
  assert.match(pairing.code, /^\d{6}$/)
  assert.equal(pairing.expiresAt, '2026-09-22T18:30:00.000Z')
  assert.match(pairing.requestToken, /^[A-Za-z0-9_-]{43}$/)
  const pairingCookie = created.headers.get('set-cookie')
  assert.match(pairingCookie, /kitchen_tv_pairing_request=/)
  const visiblePairing = { paired: false, code: pairing.code, expiresAt: pairing.expiresAt }

  const pending = await api.handleKitchenTvPublicApi(request('/api/kitchen-tv/pairing-status', 'GET', undefined, pairingCookie.split(';')[0]), env, undefined, new Date(+NOW + 1_000))
  assert.deepEqual(await pending.json(), visiblePairing)

  const pendingWithStoredToken = await api.handleKitchenTvPublicApi(
    request('/api/kitchen-tv/pairing-status', 'POST', { requestToken: pairing.requestToken }),
    env,
    undefined,
    new Date(+NOW + 1_500),
  )
  assert.deepEqual(await pendingWithStoredToken.json(), visiblePairing)

  const approved = await api.handleKitchenTvAdminApi(request('/api/kitchen-tv/approve', 'POST', { code: pairing.code }), env, await manager(), undefined, new Date(+NOW + 2_000))
  assert.equal((await approved.json()).waitingPairing, true)

  const activated = await api.handleKitchenTvPublicApi(request('/api/kitchen-tv/pairing-status', 'GET', undefined, pairingCookie.split(';')[0]), env, undefined, new Date(+NOW + 3_000))
  assert.deepEqual(await activated.json(), { paired: true })
  const cookies = activated.headers.get('set-cookie')
  const session = cookies.match(/kitchen_tv_session=([^;,]+)/)
  assert.ok(session)

  const state = await api.handleKitchenTvPublicApi(request('/api/kitchen-tv/state', 'GET', undefined, `kitchen_tv_session=${session[1]}`), env, undefined, new Date(+NOW + 4_000))
  assert.equal(state.status, 200)
  assert.deepEqual((await state.json()).orders, [])
})

test('code approval requires manage capability and rejects malformed, unknown and expired codes', async (t) => {
  const api = await apiPromise
  const { db } = setup(t)
  const env = { DB: db }
  const created = await api.handleKitchenTvPublicApi(request('/api/kitchen-tv/pairing-request', 'POST'), env, undefined, NOW)
  const { code } = await created.json()

  await assert.rejects(api.handleKitchenTvAdminApi(request('/api/kitchen-tv/approve', 'POST', { code }), env, await reader(), undefined, NOW), { status: 403 })
  await assert.rejects(api.handleKitchenTvAdminApi(request('/api/kitchen-tv/approve', 'POST', { code: '12' }), env, await manager(), undefined, NOW), { status: 400, code: 'KITCHEN_TV_PAIRING_CODE_INVALID' })
  await assert.rejects(api.handleKitchenTvAdminApi(request('/api/kitchen-tv/approve', 'POST', { code: '999999' }), env, await manager(), undefined, NOW), { status: 404, code: 'KITCHEN_TV_PAIRING_CODE_INVALID' })
  await assert.rejects(api.handleKitchenTvAdminApi(request('/api/kitchen-tv/approve', 'POST', { code }), env, await manager(), undefined, new Date(+NOW + 1_800_001)), { status: 404, code: 'KITCHEN_TV_PAIRING_CODE_INVALID' })
})

test('settings reports pending activation and revocation invalidates pending approval', async (t) => {
  const api = await apiPromise
  const { db } = setup(t)
  const env = { DB: db }
  const created = await api.handleKitchenTvPublicApi(request('/api/kitchen-tv/pairing-request', 'POST'), env, undefined, NOW)
  const { code } = await created.json()
  await api.handleKitchenTvAdminApi(request('/api/kitchen-tv/approve', 'POST', { code }), env, await manager(), undefined, NOW)

  const settings = await api.handleKitchenTvAdminApi(request('/api/kitchen-tv/settings'), env, await reader(), undefined, NOW)
  const payload = await settings.json()
  assert.equal(payload.waitingPairing, true)
  assert.equal(payload.paired, false)
  assert.equal(payload.pairingExpiresAt, '2026-09-22T18:30:00.000Z')

  await api.handleKitchenTvAdminApi(request('/api/kitchen-tv/revoke', 'POST'), env, await manager(), undefined, new Date(+NOW + 1_000))
  const after = await api.handleKitchenTvAdminApi(request('/api/kitchen-tv/settings'), env, await reader(), undefined, new Date(+NOW + 2_000))
  assert.equal((await after.json()).waitingPairing, false)
})
