import test from 'node:test'
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

for (const mode of ['legacy', 'enrollment', 'user_only']) test(`PIN configuration SQL preserves ${mode} auth mode and only configures pre-cutover credentials`, async t => {
  const fixture = await setup(t, mode)
  const old = fixture.sqlite.prepare("SELECT pin_hash FROM auth_credentials WHERE business_id='amor-e-sabor'").get().pin_hash
  const { stagingPinSql } = await import('./staging-auth-smoke.mjs')
  fixture.sqlite.exec(stagingPinSql("new'verifier"))
  assert.equal(fixture.sqlite.prepare("SELECT pin_hash FROM auth_credentials WHERE business_id='amor-e-sabor'").get().pin_hash, mode === 'user_only' ? old : "new'verifier")
  assert.equal(fixture.sqlite.prepare("SELECT mode FROM business_auth_state WHERE business_id='amor-e-sabor'").get().mode, mode)
})
