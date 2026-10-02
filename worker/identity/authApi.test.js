import test from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { handleGlobalAuthApi } from './authApi.js'

const config = { AUTH_MULTI_COMPANY_ENABLED: 'true', AUTH_EMAIL_ENABLED: 'true', AUTH_EMAIL_FROM: 'Mesiva <access@example.test>', AUTH_PUBLIC_ORIGIN: 'https://staging.example.test', RESEND_API_KEY: 're_synthetic_test_key' }
const req = (path, body, headers = {}) => new Request(`https://staging.example.test${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { origin: 'https://staging.example.test', 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
const send = (f, path, body, options = {}) => handleGlobalAuthApi(req(path, body, options.headers), { DB: f.db, ...config }, { now: f.now, ...options })

test('global login resolves one, many, zero and administrative destinations without tenant input', async (t) => {
  const f = await createTenancyFixture(t)
  for (const [email, scope, businessId] of [['bob@example.test', 'business', f.businesses.A], ['alice@example.test', 'identity', undefined], ['admin@example.test', 'platform', undefined]]) {
    const response = await send(f, '/api/auth/login', { email, password: 'Fixture password 2026!', deviceMode: 'shared' })
    assert.equal(response.status, 200)
    const payload = await response.json()
    assert.equal(payload.scope, scope); assert.equal(payload.businessId, businessId)
    assert.match(response.headers.get('set-cookie'), /^mesiva_session=/)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    if (scope !== 'business') assert.deepEqual(payload.capabilities, [])
  }
  f.sqlite.prepare("UPDATE users SET membership_state = 'inactive' WHERE account_id = ?").run(f.accounts.bob)
  assert.equal((await (await send(f, '/api/auth/login', { email: 'bob@example.test', password: 'Fixture password 2026!' })).json()).scope, 'identity')
  assert.equal((await (await send(f, '/api/auth/login', { email: 'admin@example.test', password: 'Fixture password 2026!', destination: 'platform' })).json()).scope, 'platform')
  assert.equal((await send(f, '/api/auth/login', { email: 'alice@example.test', password: 'Fixture password 2026!', destination: 'platform' })).status, 403)
})

test('login failures are generic and mutations require same origin', async (t) => {
  const f = await createTenancyFixture(t)
  const responses = []
  for (const email of ['alice@example.test', 'missing@example.test']) responses.push(await (await send(f, '/api/auth/login', { email, password: 'wrong' })).json())
  assert.deepEqual(responses[0], responses[1])
  const foreign = new Request('https://staging.example.test/api/auth/login', { method: 'POST', headers: { origin: 'https://foreign.example.test' }, body: JSON.stringify({ email: 'alice@example.test', password: 'Fixture password 2026!' }) })
  assert.equal((await handleGlobalAuthApi(foreign, { DB: f.db, ...config }, { now: f.now })).status, 403)
})

test('recovery responds before gated private lookup and provider for existing and absent accounts', async (t) => {
  for (const phase of ['lookup', 'provider']) for (const email of ['alice@example.test', 'missing@example.test']) {
    const f = await createTenancyFixture(t), tasks = []
    let releaseLookup, releaseProvider, calls = 0
    const lookupGate = new Promise((resolve) => { releaseLookup = resolve })
    const providerGate = new Promise((resolve) => { releaseProvider = resolve })
    if (phase === 'provider') releaseLookup()
    const db = { ...f.db, prepare(sql) {
      const statement = f.db.prepare(sql)
      if (!sql.includes('FROM accounts') || !sql.includes('email_normalized')) return statement
      return { ...statement, bind(...values) { const bound = statement.bind(...values); return { ...bound, async first() { await lookupGate; return bound.first() } } } }
    } }
    const pending = handleGlobalAuthApi(req('/api/auth/password-recovery', { email }), { DB: db, ...config }, { now: f.now, waitUntil: (task) => tasks.push(task), fetchImpl: async () => { calls++; await providerGate; return Response.json({ id: '22222222-2222-4222-8222-222222222222' }) } })
    let response, watchdog
    try {
      const result = await Promise.race([pending.then((value) => ({ response: value })), new Promise((resolve) => { watchdog = setTimeout(() => resolve({ blocked: true }), 2000) })])
      assert.equal(result.blocked, undefined, 'public response must not await private lookup')
      response = result.response
      assert.equal(response.status, 200)
      assert.equal(tasks.length, 1)
      releaseLookup()
      await setImmediate()
      assert.equal((await response.json()).message, 'Se houver uma conta ativa com esse e-mail, enviaremos um link para redefinir sua senha.')
      assert.equal(f.sqlite.prepare('SELECT count(*) n FROM identity_sessions WHERE revoked_at IS NULL').get().n, 4)
    } finally { clearTimeout(watchdog); releaseLookup(); releaseProvider(); await pending; await Promise.all(tasks) }
    assert.equal(calls, email === 'alice@example.test' ? 1 : 0)
    assert.equal(f.sqlite.prepare('SELECT count(*) n FROM identity_recovery_requests').get().n, 1)
  }
})

test('session discovery, company listing, selection and bodyless logout enforce their context contracts', async (t) => {
  const f = await createTenancyFixture(t)
  const login = await send(f, '/api/auth/login', { email: 'alice@example.test', password: 'Fixture password 2026!' })
  const first = await login.json(), cookie = login.headers.get('set-cookie').split(';')[0]
  const headers = { cookie, 'X-Mesiva-Context': first.contextId }
  const list = await send(f, '/api/auth/businesses', undefined, { headers })
  assert.equal(list.status, 200)
  assert.equal((await list.json()).businesses.length, 2)
  assert.equal((await send(f, '/api/auth/businesses', undefined, { headers: { cookie } })).status, 409)
  const selected = await send(f, '/api/auth/select-business', { businessId: f.businesses.B, contextId: first.contextId }, { headers })
  assert.equal(selected.status, 200)
  const current = await selected.json(), currentCookie = selected.headers.get('set-cookie').split(';')[0]
  assert.equal(current.businessId, f.businesses.B)
  assert.equal((await send(f, '/api/auth/select-business', { businessId: f.businesses.A }, { headers: { cookie: currentCookie, 'X-Mesiva-Context': first.contextId } })).status, 409)
  const logout = new Request('https://staging.example.test/api/auth/logout', { method: 'POST', headers: { origin: 'https://staging.example.test', cookie: currentCookie, 'X-Mesiva-Context': current.contextId } })
  assert.equal((await handleGlobalAuthApi(logout, { DB: f.db, ...config }, { now: f.now })).status, 200)
  assert.equal((await (await send(f, '/api/auth/session', undefined, { headers: { cookie: currentCookie } })).json()).authenticated, false)
})

test('recovery without Worker lifetime fails uniformly and never sends', async (t) => {
  const f = await createTenancyFixture(t)
  for (const email of ['alice@example.test', 'missing@example.test']) assert.equal((await send(f, '/api/auth/password-recovery', { email })).status, 503)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM identity_challenges').get().n, 0)
})
