import assert from 'node:assert/strict'
import test from 'node:test'
import { hashPin } from './auth.js'
import { handleRequest } from './index.js'

class HttpDb {
  constructor(pinHash) {
    this.pinHash = pinHash
    this.sessions = []
    this.order = {
      id: 'o1', business_id: 'amor-e-sabor', status: 'Em preparo', table_tab_id: null,
      client_name_snapshot: 'Maria', cancelled_at: null, cancel_reason: null, cancel_reason_note: null,
      payment_id: 'p1', payment_method: 'Pix', paid_amount_cents: 8000, paid_at: '2026-09-03T12:00:00.000Z',
    }
    this.refund = null
    this.deletedOrders = 0
  }

  prepare(sql) {
    const db = this
    return {
      bind(...values) {
        const statement = {
          sql,
          values,
          async first() {
            if (sql.includes('FROM auth_credentials')) return { pin_hash: db.pinHash }
            if (sql.includes('FROM sessions')) return db.sessions.find((session) => session.token_hash === values[0]) ?? null
            if (sql.includes('FROM orders o') && sql.includes('refund_movement_id')) {
              const [orderId, businessId] = values
              if (orderId !== db.order.id || businessId !== db.order.business_id) return null
              return {
                ...db.order,
                refund_movement_id: db.refund?.id ?? null,
                refund_created_at: db.refund?.created_at ?? null,
              }
            }
            if (sql.includes('COUNT(*) AS count')) return { count: 0 }
            if (sql.includes('FROM table_tabs')) return null
            return null
          },
          async all() { return { results: [] } },
          async run() {
            if (sql.includes('INSERT INTO sessions')) {
              const [id, businessId, tokenHash, createdAt, expiresAt, lastSeenAt] = values
              db.sessions.push({ id, business_id: businessId, token_hash: tokenHash, created_at: createdAt, expires_at: expiresAt, last_seen_at: lastSeenAt, revoked_at: null })
            } else if (sql.includes('SET last_seen_at')) {
              const [lastSeenAt, id, businessId] = values
              const session = db.sessions.find((item) => item.id === id && item.business_id === businessId)
              if (session) session.last_seen_at = lastSeenAt
            } else if (sql.includes("UPDATE orders SET status = 'Cancelado'")) {
              const [cancelledAt, reason, note] = values
              Object.assign(db.order, { status: 'Cancelado', cancelled_at: cancelledAt, cancel_reason: reason, cancel_reason_note: note || null })
            } else if (sql.includes('INSERT INTO movements')) {
              const [id, businessId, type, category, description, value, source, orderId, paymentId, movementDate, createdAt] = values
              db.refund = { id, business_id: businessId, type, category, description, value_cents: value, source, order_id: orderId, payment_id: paymentId, movement_date: movementDate, created_at: createdAt }
            } else if (sql.includes('DELETE FROM orders')) {
              db.deletedOrders += 1
            }
            return { success: true }
          },
        }
        return statement
      },
    }
  }

  async batch(statements) {
    for (const statement of statements) await statement.run()
    return []
  }
}

const makeEnv = async () => ({
  DB: new HttpDb(await hashPin('4827', new Uint8Array(16).fill(7))),
  LOGIN_RATE_LIMITER: { limit: async () => ({ success: true }) },
  ASSETS: { fetch: async () => new Response('asset') },
})
const mutationHeaders = (cookie) => ({ origin: 'https://delivery.example', 'content-type': 'application/json', cookie })
const loginCookie = async (env) => {
  const response = await handleRequest(new Request('https://delivery.example/api/auth/login', {
    method: 'POST', headers: { origin: 'https://delivery.example', 'content-type': 'application/json' }, body: JSON.stringify({ pin: '4827' }),
  }), env)
  return response.headers.get('set-cookie').split(';')[0]
}

test('authenticated cancel endpoint supports deferred refund', async () => {
  const env = await makeEnv()
  const cookie = await loginCookie(env)
  const response = await handleRequest(new Request('https://delivery.example/api/orders/o1/cancel', {
    method: 'POST', headers: mutationHeaders(cookie), body: JSON.stringify({ reason: 'client_changed_mind', refundNow: false }),
  }), env)
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.order.status, 'Cancelado')
  assert.equal(body.order.refundState, 'pending')
  assert.ok(body.order.cancelledAt)
  assert.equal(body.order.cancelReason, 'client_changed_mind')
  assert.equal(body.movement, null)
})

test('authenticated cancel endpoint returns immediate refund effect and deferred refund endpoint', async () => {
  const immediateEnv = await makeEnv()
  const immediateCookie = await loginCookie(immediateEnv)
  const immediate = await handleRequest(new Request('https://delivery.example/api/orders/o1/cancel', {
    method: 'POST', headers: mutationHeaders(immediateCookie), body: JSON.stringify({ reason: 'entry_error', refundNow: true, refundMethod: 'Pix' }),
  }), immediateEnv)
  assert.equal(immediate.status, 200)
  const immediateBody = await immediate.json()
  assert.equal(immediateBody.order.refundState, 'refunded')
  assert.equal(immediateBody.movement.source, 'order-refund')
  assert.equal(immediateBody.movement.orderId, 'o1')

  const deferredEnv = await makeEnv()
  const deferredCookie = await loginCookie(deferredEnv)
  deferredEnv.DB.order.status = 'Cancelado'
  deferredEnv.DB.order.cancelled_at = '2026-09-03T13:00:00.000Z'
  deferredEnv.DB.order.cancel_reason = 'duplicate_order'
  const refund = await handleRequest(new Request('https://delivery.example/api/orders/o1/refund', {
    method: 'POST', headers: mutationHeaders(deferredCookie), body: JSON.stringify({ refundMethod: 'Dinheiro' }),
  }), deferredEnv)
  assert.equal(refund.status, 201)
  const refundBody = await refund.json()
  assert.equal(refundBody.order.refundState, 'refunded')
  assert.equal(refundBody.order.cancelledAt, '2026-09-03T13:00:00.000Z')
  assert.equal(refundBody.movement.source, 'order-refund')
})

test('domain validation is returned as JSON 4xx and duplicate refund is rejected', async () => {
  const env = await makeEnv()
  const cookie = await loginCookie(env)
  const invalid = await handleRequest(new Request('https://delivery.example/api/orders/o1/cancel', {
    method: 'POST', headers: mutationHeaders(cookie), body: JSON.stringify({ refundNow: false }),
  }), env)
  assert.equal(invalid.status, 400)
  assert.equal((await invalid.json()).error.code, 'ORDER_CANCEL_REASON_REQUIRED')

  env.DB.order.status = 'Cancelado'
  env.DB.refund = { id: 'r1', created_at: '2026-09-03T13:00:00.000Z' }
  const duplicate = await handleRequest(new Request('https://delivery.example/api/orders/o1/refund', {
    method: 'POST', headers: mutationHeaders(cookie), body: JSON.stringify({ refundMethod: 'Pix' }),
  }), env)
  assert.equal(duplicate.status, 409)
  assert.equal((await duplicate.json()).error.code, 'ORDER_ALREADY_REFUNDED')
})

test('public hard delete route is gone', async () => {
  const env = await makeEnv()
  const cookie = await loginCookie(env)
  const response = await handleRequest(new Request('https://delivery.example/api/orders/o1', {
    method: 'DELETE', headers: mutationHeaders(cookie),
  }), env)
  assert.equal(response.status, 404)
  assert.equal(env.DB.deletedOrders, 0)
})
