import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveSettingsAccess } from './settingsAccess.js'
import { createSettingsDb } from './test-support/settingsDb.js'
import { issueKitchenTvPairing, loadKitchenTvAccess } from './kitchenTvRepository.js'

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

async function manager() {
  return resolveSettingsAccess({ businessId: BUSINESS, sessionId: 'manager' }, new Set(['orders.settings.manage']))
}

async function reader() {
  return resolveSettingsAccess({ businessId: BUSINESS, sessionId: 'reader' }, new Set(['orders.settings.view']))
}

test('admin manage issues a fragment-only one-time link while view-only can only read status', async (t) => {
  const api = await apiPromise
  assert.equal(typeof api.handleKitchenTvAdminApi, 'function')
  const { db } = setup(t)
  const env = { DB: db }

  const created = await api.handleKitchenTvAdminApi(request('/api/kitchen-tv/access', 'POST'), env, await manager(), undefined, NOW)
  assert.equal(created.status, 201)
  const payload = await created.json()
  const url = new URL(payload.pairingUrl)
  assert.equal(url.pathname, '/cozinha-tv')
  assert.equal(url.search, '')
  assert.match(url.hash, /^#token=[A-Za-z0-9_-]{43}$/)
  assert.equal(payload.expiresAt, '2026-09-22T18:30:00.000Z')
  const plaintext = new URLSearchParams(url.hash.slice(1)).get('token')
  const stored = await loadKitchenTvAccess(db, BUSINESS)
  assert.notEqual(stored.pairingTokenHash, plaintext)
  assert.equal(JSON.stringify(stored).includes(plaintext), false)

  const status = await api.handleKitchenTvAdminApi(request('/api/kitchen-tv/settings'), env, await reader(), undefined, NOW)
  assert.deepEqual(await status.json(), {
    configured: true, waitingPairing: true, paired: false, pairedAt: null, lastSeenAt: null, revokedAt: null,
  })
  await assert.rejects(api.handleKitchenTvAdminApi(request('/api/kitchen-tv/access', 'POST'), env, await reader(), undefined, NOW),
    { status: 403, code: 'FORBIDDEN' })
  await assert.rejects(api.handleKitchenTvAdminApi(request('/api/kitchen-tv/revoke', 'POST', undefined, undefined, false), env, await manager(), undefined, NOW),
    { status: 403, code: 'ORIGIN_NOT_ALLOWED' })
})

test('valid token pairs once, returns only a TV cookie and then reads restricted state', async (t) => {
  const api = await apiPromise
  const { db } = setup(t)
  const env = { DB: db }
  const created = await api.handleKitchenTvAdminApi(request('/api/kitchen-tv/access', 'POST'), env, await manager(), undefined, NOW)
  const token = new URLSearchParams(new URL((await created.json()).pairingUrl).hash.slice(1)).get('token')

  const paired = await api.handleKitchenTvPublicApi(request('/api/kitchen-tv/pair', 'POST', { token }), env, undefined, new Date(+NOW + 1_000))
  assert.deepEqual(await paired.json(), { paired: true })
  const cookie = paired.headers.get('set-cookie')
  assert.match(cookie, /^kitchen_tv_session=/)
  assert.equal(cookie.includes('amor_session'), false)
  await assert.rejects(api.handleKitchenTvPublicApi(request('/api/kitchen-tv/pair', 'POST', { token }), env, undefined, new Date(+NOW + 2_000)),
    { status: 401, code: 'KITCHEN_TV_PAIRING_FAILED', message: 'Não foi possível configurar esta TV. Gere um novo acesso no Gestão Delivery.' })

  const state = await api.handleKitchenTvPublicApi(request('/api/kitchen-tv/state', 'GET', undefined, cookie.split(';')[0]), env, undefined, new Date(+NOW + 3_000))
  const payload = await state.json()
  assert.equal(payload.serverNow, '2026-09-22T18:00:03.000Z')
  assert.deepEqual(payload.orders, [])
  assert.deepEqual(Object.keys(payload).sort(), ['orders', 'serverNow', 'timing'])
})

test('invalid, expired and used pairing tokens fail with the same generic public error', async (t) => {
  const api = await apiPromise
  const { db } = setup(t)
  const env = { DB: db }
  await issueKitchenTvPairing(db, BUSINESS, 'expired-hash', new Date(+NOW - 1), NOW)
  const failures = []
  for (const token of ['invalid-token', 'expired-token']) {
    try {
      await api.handleKitchenTvPublicApi(request('/api/kitchen-tv/pair', 'POST', { token }), env, undefined, NOW)
    } catch (error) {
      failures.push({ status: error.status, code: error.code, message: error.message })
    }
  }
  assert.equal(failures.length, 2)
  assert.deepEqual(failures[0], failures[1])
  assert.deepEqual(failures[0], {
    status: 401,
    code: 'KITCHEN_TV_PAIRING_FAILED',
    message: 'Não foi possível configurar esta TV. Gere um novo acesso no Gestão Delivery.',
  })
})

test('revocation and regeneration invalidate the previous TV session', async (t) => {
  const api = await apiPromise
  const { db } = setup(t)
  const env = { DB: db }
  const first = await api.handleKitchenTvAdminApi(request('/api/kitchen-tv/access', 'POST'), env, await manager(), undefined, NOW)
  const token = new URLSearchParams(new URL((await first.json()).pairingUrl).hash.slice(1)).get('token')
  const paired = await api.handleKitchenTvPublicApi(request('/api/kitchen-tv/pair', 'POST', { token }), env, undefined, NOW)
  const cookie = paired.headers.get('set-cookie').split(';')[0]

  await api.handleKitchenTvAdminApi(request('/api/kitchen-tv/revoke', 'POST'), env, await manager(), undefined, new Date(+NOW + 1_000))
  await assert.rejects(api.handleKitchenTvPublicApi(request('/api/kitchen-tv/state', 'GET', undefined, cookie), env, undefined, new Date(+NOW + 2_000)),
    { status: 401, code: 'KITCHEN_TV_UNAUTHORIZED' })

  const second = await api.handleKitchenTvAdminApi(request('/api/kitchen-tv/access', 'POST'), env, await manager(), undefined, new Date(+NOW + 3_000))
  assert.match((await second.json()).pairingUrl, /#token=/)
  await assert.rejects(api.handleKitchenTvPublicApi(request('/api/kitchen-tv/state', 'GET', undefined, cookie), env, undefined, new Date(+NOW + 4_000)),
    { status: 401, code: 'KITCHEN_TV_UNAUTHORIZED' })
})
