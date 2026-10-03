import test from 'node:test'
test('multi-company anonymous smoke rejects legacy credentials without sending recovery email', async t => {
  const { createTenancyFixture } = await import('../../worker/test-support/tenancyDb.js')
  const { handleRequest } = await import('../../worker/index.js')
  const f = await createTenancyFixture(t), paths = []
  const fetchImpl = async (url, options) => { paths.push(new URL(url).pathname); return handleRequest(new Request(url, options), { DB: f.db, AUTH_MULTI_COMPANY_ENABLED: 'true' }) }
  assert.equal((await smoke({ fetchImpl })).authMode, 'multi_company')
  assert.equal(paths.filter(path => path === '/api/auth/password-recovery').length, 2)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM identity_email_deliveries').get().n, 0)
})
import assert from 'node:assert/strict'
import { createSettingsDb } from '../../worker/test-support/settingsDb.js'
import { hashPin } from '../../worker/auth.js'
import { handleRequest } from '../../worker/index.js'

const baseUrl = 'https://staging.test'
const pin = '4827'
async function setup(t, mode) {
  const fixture = createSettingsDb(); t.after(fixture.close)
  fixture.sqlite.prepare('UPDATE business_auth_state SET mode=?').run(mode)
  fixture.sqlite.prepare("INSERT INTO auth_credentials(business_id,pin_hash,created_at,updated_at) VALUES('amor-e-sabor',?,'2026-09-30','2026-09-30')").run(await hashPin(pin))
  const env = { DB: fixture.db, LOGIN_RATE_LIMITER: { limit: async () => ({ success: true }) } }
  const fetchImpl = (url, options) => handleRequest(new Request(url, options), env)
  return { ...fixture, env, fetchImpl }
}
const smoke = async options => (await import('./staging-auth-smoke.mjs')).verifyStagingAuth({ baseUrl, attempts: 1, log() {}, ...options })

test('release verification rejects an older deployed commit before probing credentials', async t => {
  const { createTenancyFixture } = await import('../../worker/test-support/tenancyDb.js')
  const f = await createTenancyFixture(t)
  const routes = []
  await assert.rejects(smoke({ expectedCommit: 'a'.repeat(40), expectedAuthMode: 'multi_company', fetchImpl: async (url, options) => {
    const route = new URL(url).pathname; routes.push(route)
    if (route === '/release.json') return Response.json({ commit: 'b'.repeat(40), environment: 'staging' })
    return handleRequest(new Request(url, options), { DB: f.db, AUTH_MULTI_COMPANY_ENABLED: 'true' })
  } }), /published commit/)
  assert.equal(routes.includes('/api/auth/login'), false)
})

test('release verification refuses a successful but obsolete auth mode', async t => {
  const f = await setup(t, 'user_only')
  await assert.rejects(smoke({ expectedAuthMode: 'multi_company', fetchImpl: f.fetchImpl }), /expected auth mode/)
})

test('release verification waits for the exact GitHub commit then verifies real multi-company boundaries', async t => {
  const { createTenancyFixture } = await import('../../worker/test-support/tenancyDb.js')
  const f = await createTenancyFixture(t), delays = []
  let reads = 0
  const result = await smoke({ attempts: 2, expectedCommit: 'a'.repeat(40), expectedAuthMode: 'multi_company', sleep: async ms => delays.push(ms),
    fetchImpl: async (url, options) => {
      if (new URL(url).pathname === '/release.json') return Response.json({ commit: ++reads === 1 ? 'b'.repeat(40) : 'a'.repeat(40), environment: 'staging' })
      return handleRequest(new Request(url, options), { DB: f.db, AUTH_MULTI_COMPANY_ENABLED: 'true' })
    } })
  assert.equal(result.authMode, 'multi_company')
  assert.equal(reads, 2)
  assert.deepEqual(delays, [5000])
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM identity_email_deliveries').get().n, 0)
})

for (const mode of ['legacy', 'enrollment', 'user_only']) test(`staging smoke accepts real ${mode} contract and leaves no authenticated session`, async t => {
  const fixture = await setup(t, mode)
  const result = await smoke({ pin, fetchImpl: fixture.fetchImpl })
  assert.equal(result.authMode, mode)
  assert.equal(fixture.sqlite.prepare('SELECT count(*) n FROM sessions WHERE revoked_at IS NULL').get().n, 0)
  assert.equal(fixture.sqlite.prepare('SELECT count(*) n FROM users').get().n, 0)
})

test('user_only smoke needs no CI PIN or human credential and verifies non-enumerating throttled rejection', async t => {
  const fixture = await setup(t, 'user_only')
  assert.equal((await smoke({ fetchImpl: fixture.fetchImpl })).authMode, 'user_only')
  // Real persisted account quota rejects repeated invalid login without opening a session.
  for (let i = 0; i < 5; i++) await fixture.fetchImpl(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { origin: baseUrl, 'content-type': 'application/json' }, body: JSON.stringify({ pin }) })
  assert.equal((await smoke({ fetchImpl: fixture.fetchImpl })).authMode, 'user_only')
  assert.equal(fixture.sqlite.prepare('SELECT count(*) n FROM sessions').get().n, 0)
})

for (const mode of ['legacy', 'enrollment']) test(`${mode} smoke refuses missing/wrong PIN instead of accepting anonymous readiness`, async t => {
  const fixture = await setup(t, mode)
  await assert.rejects(smoke({ fetchImpl: fixture.fetchImpl }), /STAGING_PIN/)
  await assert.rejects(smoke({ pin: 'wrong', fetchImpl: fixture.fetchImpl }), /PIN login/)
})

test('smoke rejects a private bootstrap reachable without authentication', async t => {
  const fixture = await setup(t, 'user_only')
  await assert.rejects(smoke({ fetchImpl: (url, options) => new URL(url).pathname === '/api/bootstrap' ? Promise.resolve(Response.json({ orders: [{ private: true }] })) : fixture.fetchImpl(url, options) }), /Anonymous bootstrap/)
})

test('user_only smoke fails if a PIN login creates a session', async t => {
  const fixture = await setup(t, 'user_only')
  await assert.rejects(smoke({ pin, fetchImpl: (url, options) => new URL(url).pathname === '/api/auth/login' && options?.headers?.origin === baseUrl
    ? Promise.resolve(Response.json({ authenticated: true }, { headers: { 'set-cookie': 'amor_session=forbidden' } })) : fixture.fetchImpl(url, options) }), /PIN rejection/)
})

test('readiness retries bounded propagation errors but rejects unknown auth mode and leaked anonymous identity', async t => {
  const fixture = await setup(t, 'user_only')
  let first = true
  assert.equal((await smoke({ attempts: 2, sleep: async () => {}, fetchImpl: (url, options) => { if (first) { first = false; return Promise.resolve(new Response('', { status: 503 })) } return fixture.fetchImpl(url, options) } })).authMode, 'user_only')
  for (const session of [{ authenticated: false, authMode: 'unknown' }, { authenticated: true, authMode: 'user_only', user: { id: 'private' } }]) {
    await assert.rejects(smoke({ fetchImpl: () => Promise.resolve(Response.json(session, { headers: { 'cache-control': 'no-store' } })) }), /Anonymous session/)
  }
})

test('readiness waits through stale HTTP 200 wire responses until the current anonymous contract arrives', async t => {
  const fixture = await setup(t, 'user_only')
  const stale = [
    () => Response.json({ authenticated: false }),
    () => Response.json({ authenticated: false }, { headers: { 'cache-control': 'no-store' } }),
  ]
  const delays = []
  const result = await smoke({ attempts: 3, sleep: async ms => delays.push(ms), fetchImpl: (url, options) => stale.length
    ? Promise.resolve(stale.shift()()) : fixture.fetchImpl(url, options) })
  assert.equal(result.authMode, 'user_only')
  assert.deepEqual(delays, [5000, 5000])
})

test('persistent invalid HTTP 200 contracts exhaust readiness without reaching login or logging private data', async () => {
  const invalidResponses = [
    () => Response.json({ authenticated: false }, { headers: { 'cache-control': 'no-store' } }),
    () => Response.json({ authenticated: false, authMode: 'user_only' }, { headers: { 'cache-control': 'no-store', 'set-cookie': 'amor_session=PRIVATE-COOKIE' } }),
    () => Response.json({ authenticated: true, authMode: 'user_only', user: { displayName: 'PRIVATE-NAME' } }, { headers: { 'cache-control': 'no-store' } }),
    () => new Response('PRIVATE-MALFORMED', { headers: { 'cache-control': 'no-store' } }),
  ]
  for (const response of invalidResponses) {
    let reads = 0
    const delays = [], logs = []
    await assert.rejects(smoke({ attempts: 3, log: value => logs.push(value), sleep: async ms => delays.push(ms), fetchImpl: async url => {
      assert.equal(new URL(url).pathname, '/api/auth/session', 'invalid readiness cannot advance to private/auth APIs')
      reads++
      return response()
    } }), /bounded propagation window/)
    assert.equal(reads, 3)
    assert.deepEqual(delays, [5000, 5000])
    assert.doesNotMatch(logs.join('\n'), /PRIVATE-/)
  }
})

for (const mode of ['legacy', 'enrollment', 'user_only']) test(`PIN configuration SQL preserves ${mode} auth mode and only configures pre-cutover credentials`, async t => {
  const fixture = await setup(t, mode)
  const old = fixture.sqlite.prepare("SELECT pin_hash FROM auth_credentials WHERE business_id='amor-e-sabor'").get().pin_hash
  const { stagingPinSql } = await import('./staging-auth-smoke.mjs')
  fixture.sqlite.exec(stagingPinSql("new'verifier"))
  assert.equal(fixture.sqlite.prepare("SELECT pin_hash FROM auth_credentials WHERE business_id='amor-e-sabor'").get().pin_hash, mode === 'user_only' ? old : "new'verifier")
  assert.equal(fixture.sqlite.prepare("SELECT mode FROM business_auth_state WHERE business_id='amor-e-sabor'").get().mode, mode)
})

test('email smoke checks identifier rejection and public challenge boundaries without sending any email', async t => {
  const fixture = await setup(t, 'user_only')
  const calls = [], logs = []
  await smoke({ log: value => logs.push(value), fetchImpl: (url, options) => {
    calls.push({ path: new URL(url).pathname, method: options?.method || 'GET', origin: options?.headers?.origin, body: options?.body && JSON.parse(options.body) })
    return fixture.fetchImpl(url, options)
  } })
  assert.ok(calls.some(call => call.path === '/api/auth/login' && call.body?.identifier))
  for (const route of ['/api/auth/password-recovery', '/api/auth/email-challenges/inspect', '/api/auth/email-challenges/complete']) {
    assert.ok(calls.some(call => call.path === route && call.method === 'GET'))
    assert.ok(calls.some(call => call.path === route && call.origin === 'https://invalid-staging-origin.example'))
  }
  assert.equal(calls.filter(call => call.path === '/api/auth/password-recovery' && call.method === 'POST' && call.origin === baseUrl).length, 0)
  assert.equal(fixture.sqlite.prepare('SELECT count(*) n FROM auth_email_deliveries').get().n, 0)
  assert.equal(fixture.sqlite.prepare('SELECT count(*) n FROM sessions').get().n, 0)
  assert.doesNotMatch(logs.join('\n'), /token|PRIVATE-/i)
})

test('email smoke rejects an identifier-only login that issues a cookie', async t => {
  const fixture = await setup(t, 'user_only')
  await assert.rejects(smoke({ fetchImpl: (url, options) => {
    const body = options?.body && JSON.parse(options.body)
    return new URL(url).pathname === '/api/auth/login' && body?.identifier
      ? Promise.resolve(Response.json({ authenticated: true }, { headers: { 'set-cookie': 'amor_session=PRIVATE-SESSION' } })) : fixture.fetchImpl(url, options)
  } }), /identifier rejection/)
})

test('email smoke rejects a challenge completion that issues a cookie and never logs its response', async t => {
  const fixture = await setup(t, 'user_only'), logs = []
  await assert.rejects(smoke({ log: value => logs.push(value), fetchImpl: (url, options) => new URL(url).pathname === '/api/auth/email-challenges/complete' && options?.headers?.origin === baseUrl
    ? Promise.resolve(Response.json({ completed: true, token: 'PRIVATE-TOKEN' }, { status: 400, headers: { 'cache-control': 'no-store', 'set-cookie': 'amor_session=PRIVATE-SESSION' } })) : fixture.fetchImpl(url, options) }), /challenge completion/)
  assert.doesNotMatch(logs.join('\n'), /PRIVATE-/)
})

test('email smoke requires uncached rejection of public email mutations', async t => {
  const fixture = await setup(t, 'user_only')
  await assert.rejects(smoke({ fetchImpl: (url, options) => new URL(url).pathname === '/api/auth/password-recovery'
    ? Promise.resolve(Response.json({ error: { code: 'ORIGIN_NOT_ALLOWED' } }, { status: 403 })) : fixture.fetchImpl(url, options) }), /email boundary/)
})
