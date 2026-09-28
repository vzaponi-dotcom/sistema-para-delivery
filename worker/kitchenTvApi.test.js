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


test('legacy Tizen can complete activation without relying on Set-Cookie persistence', async (t) => {
  const api = await apiPromise
  const { db } = setup(t)
  const env = { DB: db }

  const created = await api.handleKitchenTvPublicApi(request('/api/kitchen-tv/pairing-request', 'POST'), env, undefined, NOW)
  const pairing = await created.json()
  await api.handleKitchenTvAdminApi(request('/api/kitchen-tv/approve', 'POST', { code: pairing.code }), env, await manager(), undefined, new Date(+NOW + 2_000))

  const activated = await api.handleKitchenTvPublicApi(new Request('https://delivery.example/api/kitchen-tv/pairing-status', {
    method: 'POST',
    headers: {
      origin: 'https://delivery.example',
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.5) AppleWebKit/537.36',
    },
    body: JSON.stringify({ requestToken: pairing.requestToken }),
  }), env, undefined, new Date(+NOW + 3_000))

  const activation = await activated.json()
  assert.equal(activation.paired, true)
  assert.match(activation.sessionToken, /^[A-Za-z0-9_-]{43}$/)
  assert.match(activated.headers.get('set-cookie'), /^kitchen_tv_session=/)
  assert.doesNotMatch(activated.headers.get('set-cookie'), /kitchen_tv_pairing_request=/)

  const state = await api.handleKitchenTvPublicApi(new Request('https://delivery.example/api/kitchen-tv/state', {
    headers: { 'x-kitchen-tv-session': activation.sessionToken },
  }), env, undefined, new Date(+NOW + 4_000))
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


const controlReader = () => resolveSettingsAccess(
  { businessId: BUSINESS, sessionId: 'control-reader' },
  new Set(['orders.view']),
)
const controller = () => resolveSettingsAccess(
  { businessId: BUSINESS, sessionId: 'controller' },
  new Set(['orders.view', 'orders.kitchen.control']),
)

function insertControlOrder(sqlite, {
  id,
  number,
  status = 'Em preparo',
  scheduledFor = null,
  finishedAt = null,
}) {
  sqlite.prepare(`INSERT INTO orders (
    id, business_id, client_name_snapshot, type, order_date, status,
    subtotal_cents, total_cents, created_at, finished_at, scheduled_for,
    cancelled_at, order_number
  ) VALUES (?, ?, ?, 'Entrega', '2026-09-22', ?, 1000, 1000, ?, ?, ?, NULL, ?)`)
    .run(id, BUSINESS, `Cliente ${id}`, status, NOW.toISOString(), finishedAt, scheduledFor, number)
}

test('control read is available to orders.view while page mutations require orders.kitchen.control', async (t) => {
  const api = await apiPromise
  const { db } = setup(t)
  const env = { DB: db }

  const initial = await api.handleKitchenTvAdminApi(
    request('/api/kitchen-tv/control'),
    env,
    await controlReader(),
    undefined,
    NOW,
  )
  assert.deepEqual(await initial.json(), {
    paired: false,
    control: { revision: 0, requestedPage: 1, updatedAt: null },
    telemetry: null,
    hiddenOrderIds: [],
  })

  await assert.rejects(
    api.handleKitchenTvAdminApi(
      request('/api/kitchen-tv/control/page', 'PATCH', { page: 2 }),
      env,
      await controlReader(),
      undefined,
      NOW,
    ),
    { status: 403 },
  )

  const changed = await api.handleKitchenTvAdminApi(
    request('/api/kitchen-tv/control/page', 'PATCH', { page: 2 }),
    env,
    await controller(),
    undefined,
    NOW,
  )
  assert.deepEqual((await changed.json()).control, {
    revision: 1,
    requestedPage: 2,
    updatedAt: NOW.toISOString(),
  })

  await assert.rejects(
    api.handleKitchenTvAdminApi(
      request('/api/kitchen-tv/control/page', 'PATCH', { page: 0 }),
      env,
      await controller(),
      undefined,
      NOW,
    ),
    { status: 400, code: 'KITCHEN_TV_PAGE_INVALID' },
  )
  await assert.rejects(
    api.handleKitchenTvAdminApi(
      request('/api/kitchen-tv/control/page', 'PATCH', { page: 3 }, undefined, false),
      env,
      await controller(),
      undefined,
      NOW,
    ),
    { status: 403, code: 'ORIGIN_NOT_ALLOWED' },
  )
})

test('controller hides and restores only eligible preparing orders, idempotently', async (t) => {
  const api = await apiPromise
  const { db, sqlite } = setup(t)
  const env = { DB: db }
  insertControlOrder(sqlite, { id: 'active-control', number: 301 })
  insertControlOrder(sqlite, { id: 'scheduled-control', number: 302, scheduledFor: '2026-09-22T21:00:00.000Z' })
  insertControlOrder(sqlite, { id: 'finished-control', number: 303, status: 'Finalizado', finishedAt: '2026-09-22T18:10:00.000Z' })

  const hiddenPath = '/api/kitchen-tv/control/orders/active-control/hidden'
  await assert.rejects(
    api.handleKitchenTvAdminApi(request(hiddenPath, 'PUT'), env, await controlReader(), undefined, NOW),
    { status: 403 },
  )

  for (let index = 0; index < 2; index += 1) {
    const hidden = await api.handleKitchenTvAdminApi(request(hiddenPath, 'PUT'), env, await controller(), undefined, NOW)
    assert.deepEqual(await hidden.json(), { orderId: 'active-control', hidden: true })
  }

  const control = await api.handleKitchenTvAdminApi(request('/api/kitchen-tv/control'), env, await controller(), undefined, NOW)
  assert.deepEqual((await control.json()).hiddenOrderIds, ['active-control'])

  await assert.rejects(
    api.handleKitchenTvAdminApi(
      request('/api/kitchen-tv/control/orders/scheduled-control/hidden', 'PUT'),
      env,
      await controller(),
      undefined,
      NOW,
    ),
    { status: 409, code: 'KITCHEN_TV_ORDER_NOT_ELIGIBLE' },
  )
  await assert.rejects(
    api.handleKitchenTvAdminApi(
      request('/api/kitchen-tv/control/orders/finished-control/hidden', 'PUT'),
      env,
      await controller(),
      undefined,
      NOW,
    ),
    { status: 409, code: 'KITCHEN_TV_ORDER_NOT_ELIGIBLE' },
  )
  await assert.rejects(
    api.handleKitchenTvAdminApi(
      request('/api/kitchen-tv/control/orders/does-not-exist/hidden', 'PUT'),
      env,
      await controller(),
      undefined,
      NOW,
    ),
    { status: 404, code: 'ORDER_NOT_FOUND' },
  )

  for (let index = 0; index < 2; index += 1) {
    const restored = await api.handleKitchenTvAdminApi(request(hiddenPath, 'DELETE'), env, await controller(), undefined, NOW)
    assert.deepEqual(await restored.json(), { orderId: 'active-control', hidden: false })
  }
})

test('paired TV can report bounded telemetry but cannot use an admin session as its credential', async (t) => {
  const api = await apiPromise
  const { db } = setup(t)
  const env = { DB: db }

  const created = await api.handleKitchenTvPublicApi(request('/api/kitchen-tv/pairing-request', 'POST'), env, undefined, NOW)
  const pairing = await created.json()
  const pairingCookie = created.headers.get('set-cookie').split(';')[0]
  await api.handleKitchenTvAdminApi(
    request('/api/kitchen-tv/approve', 'POST', { code: pairing.code }),
    env,
    await manager(),
    undefined,
    new Date(+NOW + 1_000),
  )
  const activated = await api.handleKitchenTvPublicApi(
    request('/api/kitchen-tv/pairing-status', 'GET', undefined, pairingCookie),
    env,
    undefined,
    new Date(+NOW + 2_000),
  )
  const token = activated.headers.get('set-cookie').match(/kitchen_tv_session=([^;,]+)/)?.[1]
  assert.ok(token)
  const tvCookie = `kitchen_tv_session=${token}`

  await assert.rejects(
    api.handleKitchenTvPublicApi(
      request('/api/kitchen-tv/report', 'POST', {
        appliedRevision: 0,
        currentPage: 1,
        pageCount: 1,
        viewportWidth: 960,
        viewportHeight: 540,
        visibleOrderIds: [],
      }),
      env,
      undefined,
      new Date(+NOW + 3_000),
    ),
    { status: 401, code: 'KITCHEN_TV_UNAUTHORIZED' },
  )

  const report = await api.handleKitchenTvPublicApi(
    request('/api/kitchen-tv/report', 'POST', {
      appliedRevision: 0,
      currentPage: 1,
      pageCount: 2,
      viewportWidth: 960,
      viewportHeight: 540,
      visibleOrderIds: ['o-1', 'o-2'],
    }, tvCookie),
    env,
    undefined,
    new Date(+NOW + 4_000),
  )
  assert.deepEqual(await report.json(), { reported: true })

  const state = await api.handleKitchenTvAdminApi(
    request('/api/kitchen-tv/control'),
    env,
    await controller(),
    undefined,
    new Date(+NOW + 5_000),
  )
  const payload = await state.json()
  assert.equal(payload.paired, true)
  assert.deepEqual(payload.telemetry, {
    appliedRevision: 0,
    currentPage: 1,
    pageCount: 2,
    viewportWidth: 960,
    viewportHeight: 540,
    visibleOrderIds: ['o-1', 'o-2'],
    reportedAt: new Date(+NOW + 4_000).toISOString(),
  })

  await assert.rejects(
    api.handleKitchenTvPublicApi(
      request('/api/kitchen-tv/report', 'POST', {
        appliedRevision: 0,
        currentPage: 1,
        pageCount: 1,
        viewportWidth: 960,
        viewportHeight: 540,
        visibleOrderIds: Array.from({ length: 101 }, (_, index) => `o-${index}`),
      }, tvCookie),
      env,
      undefined,
      new Date(+NOW + 6_000),
    ),
    { status: 400, code: 'KITCHEN_TV_REPORT_INVALID' },
  )
})


function markKitchenTvPaired(sqlite, { revokedAt = null } = {}) {
  const pairedAt = NOW.toISOString()
  sqlite.prepare(`INSERT INTO kitchen_tv_access (
    business_id, pairing_token_hash, pairing_expires_at, session_token_hash,
    session_issued_at, paired_at, last_seen_at, revoked_at, created_at, updated_at
  ) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(business_id) DO UPDATE SET
    session_token_hash = excluded.session_token_hash,
    session_issued_at = excluded.session_issued_at,
    paired_at = excluded.paired_at,
    last_seen_at = excluded.last_seen_at,
    revoked_at = excluded.revoked_at,
    updated_at = excluded.updated_at`)
    .run(BUSINESS, 'test-session-hash', pairedAt, pairedAt, pairedAt, revokedAt, pairedAt, pairedAt)
}

test('control mutations reject an unpaired TV instead of queueing commands for later', async (t) => {
  const api = await apiPromise
  const { db, sqlite } = setup(t)
  const env = { DB: db }
  insertControlOrder(sqlite, { id: 'unpaired-control', number: 401 })

  await assert.rejects(
    api.handleKitchenTvAdminApi(
      request('/api/kitchen-tv/control/page', 'PATCH', { page: 2 }),
      env,
      await controller(),
      undefined,
      NOW,
    ),
    { status: 409, code: 'KITCHEN_TV_NOT_PAIRED' },
  )
  await assert.rejects(
    api.handleKitchenTvAdminApi(
      request('/api/kitchen-tv/control/orders/unpaired-control/hidden', 'PUT'),
      env,
      await controller(),
      undefined,
      NOW,
    ),
    { status: 409, code: 'KITCHEN_TV_NOT_PAIRED' },
  )
  await assert.rejects(
    api.handleKitchenTvAdminApi(
      request('/api/kitchen-tv/control/orders/unpaired-control/hidden', 'DELETE'),
      env,
      await controller(),
      undefined,
      NOW,
    ),
    { status: 409, code: 'KITCHEN_TV_NOT_PAIRED' },
  )
})

test('revoked TV access blocks every administrative control mutation', async (t) => {
  const api = await apiPromise
  const { db, sqlite } = setup(t)
  const env = { DB: db }
  insertControlOrder(sqlite, { id: 'revoked-control', number: 402 })
  markKitchenTvPaired(sqlite, { revokedAt: new Date(+NOW + 1_000).toISOString() })

  for (const [path, method, body] of [
    ['/api/kitchen-tv/control/page', 'PATCH', { page: 2 }],
    ['/api/kitchen-tv/control/orders/revoked-control/hidden', 'PUT', undefined],
    ['/api/kitchen-tv/control/orders/revoked-control/hidden', 'DELETE', undefined],
  ]) {
    await assert.rejects(
      api.handleKitchenTvAdminApi(request(path, method, body), env, await controller(), undefined, NOW),
      { status: 409, code: 'KITCHEN_TV_NOT_PAIRED' },
    )
  }
})
