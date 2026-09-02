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

const headers = (cookie, extra = {}) => ({ origin: 'https://delivery.example', 'content-type': 'application/json', cookie, ...extra })
const baseCart = { clientId: 'c1', type: 'Entrega', orderDate: '2026-09-01', items: [{ productId: 'p1', quantity: 1, note: '' }], deliveryFee: 0, adjustment: { type: 'none', mode: 'fixed', value: 0, reason: '' } }

test('order checkout rejects missing idempotency key and malformed cart fields before DB writes', async () => {
  const { env, cookie } = await loggedIn()
  const missingKey = await handleRequest(new Request('https://delivery.example/api/orders', { method: 'POST', headers: headers(cookie), body: JSON.stringify(baseCart) }), env)
  assert.equal(missingKey.status, 400)
  assert.equal((await missingKey.json()).error.code, 'VALIDATION_ERROR')

  for (const body of [
    { ...baseCart, items: [{ productId: 'p1', quantity: 1, note: 'x'.repeat(301) }] },
    { ...baseCart, type: 'Retirada', deliveryFee: 5 },
    { ...baseCart, adjustment: { type: 'discount', mode: 'percentage', value: 100.01, reason: '' } },
    { ...baseCart, paymentMethod: 'Cheque' },
  ]) {
    const response = await handleRequest(new Request('https://delivery.example/api/orders', {
      method: 'POST', headers: headers(cookie, { 'idempotency-key': crypto.randomUUID() }), body: JSON.stringify(body),
    }), env)
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR')
  }
})

test('valid cart passes route validation and reaches repository lookup', async () => {
  const { env, cookie } = await loggedIn()
  const response = await handleRequest(new Request('https://delivery.example/api/orders', {
    method: 'POST', headers: headers(cookie, { 'idempotency-key': 'valid-cart' }), body: JSON.stringify(baseCart),
  }), env)
  assert.equal(response.status, 404)
  assert.equal((await response.json()).error.code, 'CLIENT_NOT_FOUND')
})

test('invalid status is still rejected independently of checkout', async () => {
  const { env, cookie } = await loggedIn()
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
