import test from 'node:test'
import assert from 'node:assert/strict'
import { hashPin } from './auth.js'
import { handleRequest } from './index.js'

class AuthOnlyDb {
  constructor(pinHash) { this.pinHash = pinHash; this.sessions = [] }
  prepare(sql) {
    const db = this
    return { bind(...values) { return {
      async first() {
        if (sql.includes('FROM auth_credentials')) return { pin_hash: db.pinHash }
        if (sql.includes('FROM sessions')) return db.sessions.find((item) => item.token_hash === values[0]) ?? null
        return null
      },
      async run() {
        if (sql.includes('INSERT INTO sessions')) { const [id, businessId, tokenHash, createdAt, expiresAt, lastSeenAt] = values; db.sessions.push({ id, business_id: businessId, token_hash: tokenHash, created_at: createdAt, expires_at: expiresAt, last_seen_at: lastSeenAt, revoked_at: null }) }
        else if (sql.includes('SET last_seen_at')) { const [lastSeenAt, id] = values; const row = db.sessions.find((item) => item.id === id); if (row) row.last_seen_at = lastSeenAt }
        return { success: true }
      },
    } } }
  }
}

const loggedIn = async () => {
  const env = { DB: new AuthOnlyDb(await hashPin('4827', new Uint8Array(16).fill(7))), LOGIN_RATE_LIMITER: { limit: async () => ({ success: true }) } }
  const response = await handleRequest(new Request('https://delivery.example/api/auth/login', { method: 'POST', headers: { origin: 'https://delivery.example', 'content-type': 'application/json' }, body: JSON.stringify({ pin: '4827' }) }), env)
  return { env, cookie: response.headers.get('set-cookie').split(';')[0] }
}

const headers = (cookie) => ({ origin: 'https://delivery.example', 'content-type': 'application/json', cookie })

test('order routes reject missing idempotency key and invalid status before DB writes', async () => {
  const { env, cookie } = await loggedIn()
  const create = await handleRequest(new Request('https://delivery.example/api/orders', { method: 'POST', headers: headers(cookie), body: JSON.stringify({ clientId: 'c1', productId: 'p1', type: 'Entrega', quantity: 1, orderDate: '2026-09-01' }) }), env)
  assert.equal(create.status, 400)
  assert.equal((await create.json()).error.code, 'VALIDATION_ERROR')
  const status = await handleRequest(new Request('https://delivery.example/api/orders/o1/status', { method: 'PATCH', headers: headers(cookie), body: JSON.stringify({ status: 'Em preparo' }) }), env)
  assert.equal(status.status, 400)
  assert.equal((await status.json()).error.code, 'INVALID_STATUS')
})

test('payment and manual movement reject invalid values before DB writes', async () => {
  const { env, cookie } = await loggedIn()
  const payment = await handleRequest(new Request('https://delivery.example/api/orders/o1/payment', { method: 'POST', headers: headers(cookie), body: JSON.stringify({ method: 'Cheque' }) }), env)
  assert.equal(payment.status, 400)
  const movement = await handleRequest(new Request('https://delivery.example/api/movements', { method: 'POST', headers: headers(cookie), body: JSON.stringify({ type: 'saida', category: 'Insumos', description: 'Arroz', value: 0 }) }), env)
  assert.equal(movement.status, 400)
})
