import test from 'node:test'
import assert from 'node:assert/strict'
import { hashPin } from './auth.js'
import { handleRequest } from './index.js'

class FakeDb {
  constructor(pinHash) {
    this.pinHash = pinHash
    this.sessions = []
  }

  prepare(sql) {
    const db = this
    return {
      bind(...values) {
        return {
          async first() {
            if (sql.includes('FROM auth_credentials')) {
              return values[0] === 'amor-e-sabor' ? { pin_hash: db.pinHash } : null
            }
            if (sql.includes('FROM sessions')) {
              return db.sessions.find((session) => session.token_hash === values[0]) ?? null
            }
            return null
          },
          async run() {
            if (sql.includes('INSERT INTO sessions')) {
              const [id, businessId, tokenHash, createdAt, expiresAt, lastSeenAt] = values
              db.sessions.push({ id, business_id: businessId, token_hash: tokenHash, created_at: createdAt, expires_at: expiresAt, last_seen_at: lastSeenAt, revoked_at: null })
            } else if (sql.includes('SET last_seen_at')) {
              const [lastSeenAt, id, businessId] = values
              const session = db.sessions.find((item) => item.id === id && item.business_id === businessId)
              if (session) session.last_seen_at = lastSeenAt
            } else if (sql.includes('SET revoked_at')) {
              const [revokedAt, tokenHash] = values
              const session = db.sessions.find((item) => item.token_hash === tokenHash)
              if (session) session.revoked_at = revokedAt
            }
            return { success: true }
          },
        }
      },
    }
  }
}

const makeEnv = async ({ rateLimitSuccess = true } = {}) => ({
  DB: new FakeDb(await hashPin('4827', new Uint8Array(16).fill(7))),
  LOGIN_RATE_LIMITER: { limit: async ({ key }) => ({ success: key === 'amor-e-sabor:auth-login' && rateLimitSuccess }) },
  ASSETS: { fetch: async () => new Response('asset') },
})

const mutationHeaders = (extra = {}) => ({ origin: 'https://delivery.example', 'content-type': 'application/json', ...extra })

const login = async (env, pin = '4827') => handleRequest(new Request('https://delivery.example/api/auth/login', {
  method: 'POST',
  headers: mutationHeaders(),
  body: JSON.stringify({ pin }),
}), env)

test('session endpoint is unauthenticated without a cookie', async () => {
  const env = await makeEnv()
  const response = await handleRequest(new Request('https://delivery.example/api/auth/session'), env)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { authenticated: false })
})

test('invalid PIN is rejected without exposing credentials', async () => {
  const env = await makeEnv()
  const response = await login(env, '9999')
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: { code: 'INVALID_PIN', message: 'PIN inválido.' } })
})

test('valid PIN creates a cookie-only session', async () => {
  const env = await makeEnv()
  const response = await login(env)
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body, { authenticated: true, businessId: 'amor-e-sabor' })
  assert.equal('token' in body, false)
  const cookie = response.headers.get('set-cookie')
  assert.match(cookie, /^amor_session=/)
  assert.match(cookie, /HttpOnly/)

  const sessionResponse = await handleRequest(new Request('https://delivery.example/api/auth/session', {
    headers: { cookie: cookie.split(';')[0] },
  }), env)
  assert.deepEqual(await sessionResponse.json(), { authenticated: true, businessId: 'amor-e-sabor' })
})

test('business API route rejects requests without a valid session', async () => {
  const env = await makeEnv()
  const response = await handleRequest(new Request('https://delivery.example/api/bootstrap'), env)
  assert.equal(response.status, 401)
  assert.equal((await response.json()).error.code, 'UNAUTHENTICATED')
})

test('logout revokes the current session and clears the cookie', async () => {
  const env = await makeEnv()
  const loginResponse = await login(env)
  const cookiePair = loginResponse.headers.get('set-cookie').split(';')[0]
  const response = await handleRequest(new Request('https://delivery.example/api/auth/logout', {
    method: 'POST',
    headers: mutationHeaders({ cookie: cookiePair }),
  }), env)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/)

  const sessionResponse = await handleRequest(new Request('https://delivery.example/api/auth/session', { headers: { cookie: cookiePair } }), env)
  assert.deepEqual(await sessionResponse.json(), { authenticated: false })
})

test('login is rate limited before PIN verification', async () => {
  const env = await makeEnv({ rateLimitSuccess: false })
  const response = await login(env)
  assert.equal(response.status, 429)
  assert.equal((await response.json()).error.code, 'LOGIN_RATE_LIMITED')
  assert.equal(env.DB.sessions.length, 0)
})

test('mutations reject a missing or cross-origin Origin header', async () => {
  const env = await makeEnv()
  const response = await handleRequest(new Request('https://delivery.example/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '4827' }),
  }), env)
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error.code, 'ORIGIN_NOT_ALLOWED')
})
