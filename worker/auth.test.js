import test from 'node:test'
import assert from 'node:assert/strict'
import { clearSessionCookie, createSession, getAuthenticatedSession, hashPin, revokeSession, sessionCookie, verifyPin } from './auth.js'

class SessionDb {
  constructor() {
    this.sessions = []
  }

  prepare(sql) {
    const db = this
    return {
      bind(...values) {
        return {
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
              const session = db.sessions.find((item) => item.token_hash === tokenHash && !item.revoked_at)
              if (session) session.revoked_at = revokedAt
            }
            return { success: true }
          },
          async first() {
            const [tokenHash] = values
            return db.sessions.find((item) => item.token_hash === tokenHash) ?? null
          },
        }
      },
    }
  }
}

test('hashPin verifier accepts the original PIN and rejects a different PIN', async () => {
  const verifier = await hashPin('4827', new Uint8Array(16).fill(7))
  assert.equal(await verifyPin('4827', verifier), true)
  assert.equal(await verifyPin('9999', verifier), false)
})

test('hashPin and verifyPin enforce an exact 16-byte salt', async () => {
  await assert.rejects(() => hashPin('4827', new Uint8Array(15)))
  const malformed = 'pbkdf2-sha256$210000$AQ==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
  assert.equal(await verifyPin('4827', malformed), false)
})

test('verifyPin rejects malformed verifier strings', async () => {
  assert.equal(await verifyPin('4827', 'not-a-verifier'), false)
  assert.equal(await verifyPin('4827', 'pbkdf2-sha256$1$abc$abc'), false)
})

test('session cookie is HttpOnly, Secure and Strict', () => {
  const cookie = sessionCookie('opaque-token', 604800)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /SameSite=Strict/)
  assert.match(cookie, /Path=\//)
  assert.match(cookie, /Max-Age=604800/)
  assert.match(clearSessionCookie(), /Max-Age=0/)
})

test('session persistence stores only a token hash and authenticates cookie', async () => {
  const DB = new SessionDb()
  const now = new Date('2026-09-01T20:00:00.000Z')
  const { token } = await createSession({ DB }, 'amor-e-sabor', now)
  assert.equal(DB.sessions.length, 1)
  assert.notEqual(DB.sessions[0].token_hash, token)
  assert.equal(DB.sessions[0].token_hash.length, 64)

  const request = new Request('https://delivery.example/api/auth/session', { headers: { cookie: `amor_session=${token}` } })
  const session = await getAuthenticatedSession(request, { DB }, new Date('2026-09-01T20:05:00.000Z'))
  assert.deepEqual(session, { businessId: 'amor-e-sabor', sessionId: DB.sessions[0].id })
})

test('expired and revoked sessions are rejected', async () => {
  const DB = new SessionDb()
  const now = new Date('2026-09-01T20:00:00.000Z')
  const { token } = await createSession({ DB }, 'amor-e-sabor', now)
  const request = new Request('https://delivery.example/', { headers: { cookie: `amor_session=${token}` } })

  assert.equal(await getAuthenticatedSession(request, { DB }, new Date('2026-09-09T20:00:00.000Z')), null)

  await revokeSession(request, { DB }, new Date('2026-09-01T21:00:00.000Z'))
  assert.equal(await getAuthenticatedSession(request, { DB }, new Date('2026-09-01T21:01:00.000Z')), null)
})
