import { apiError, assertSameOriginMutation, json, readJson } from '../http.js'
import { hashHumanPassword } from './credentials.js'

const digestToken = async (token) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))),
  (byte) => byte.toString(16).padStart(2, '0')).join('')
const invalidInvitation = () => apiError(400, 'INVALID_INVITATION', 'Convite inválido ou expirado. Solicite um novo convite.')

// Preparation performs no writes. Callers append official account/audit writes
// and await one D1 batch, then expose token/expiresAt only after commit.
export async function prepareAccessInvite(db, { businessId, userId, purpose, issuedBy = null, now = new Date() }) {
  if (!['activation', 'reset'].includes(purpose)) throw apiError(400, 'INVALID_INVITATION_PURPOSE', 'Finalidade do convite inválida.')
  const timestamp = now.toISOString()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  const tokenHash = await digestToken(token)
  const statements = [
    db.prepare(`UPDATE access_invites SET revoked_at = ? WHERE business_id = ? AND user_id = ? AND consumed_at IS NULL AND revoked_at IS NULL`).bind(timestamp, businessId, userId),
  ]
  if (purpose === 'reset') {
    statements.push(
      db.prepare(`UPDATE user_credentials SET active = 0, updated_at = ? WHERE business_id = ? AND user_id = ?`).bind(timestamp, businessId, userId),
      db.prepare(`UPDATE sessions SET revoked_at = ? WHERE business_id = ? AND user_id = ? AND revoked_at IS NULL`).bind(timestamp, businessId, userId),
    )
  }
  // A NULL purpose deliberately violates the existing NOT NULL constraint.
  // The database checks this at execution, aborting the entire official batch
  // if activation would replace an active credential. No pre-read race and
  // no silent zero-row insert that could leave caller/audit writes committed.
  statements.push(db.prepare(`INSERT INTO access_invites (id, business_id, user_id, purpose, token_hash, expires_at, issued_by_user_id, created_at)
    VALUES (?, ?, ?, CASE WHEN ? = 'activation' AND EXISTS (
      SELECT 1 FROM user_credentials WHERE business_id = ? AND user_id = ? AND active = 1
    ) THEN NULL ELSE ? END, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), businessId, userId, purpose, businessId, userId, purpose, tokenHash, expiresAt, issuedBy, timestamp))
  return { token, expiresAt, statements }
}

export async function issueAccessInvite(db, options) {
  const { token, expiresAt, statements } = await prepareAccessInvite(db, options)
  try {
    await db.batch(statements)
  } catch (error) {
    if (options.purpose === 'activation' && String(error?.message).includes('NOT NULL constraint failed: access_invites.purpose')) {
      throw apiError(409, 'INVITATION_ALREADY_ACTIVATED', 'A conta já possui senha. Inicie uma redefinição.')
    }
    throw error
  }
  return { token, expiresAt }
}

export async function consumeAccessInvite(db, { token, password, now = new Date(), businessId = null }) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw invalidInvitation()
  const tokenHash = await digestToken(token)
  const timestamp = now.toISOString()
  const verifier = await hashHumanPassword(password)
  const eligible = `token_hash = ? AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > ?
    AND (? IS NULL OR business_id = ?)
    AND EXISTS (SELECT 1 FROM users u JOIN roles r ON r.business_id = u.business_id AND r.id = u.role_id
      WHERE u.business_id = access_invites.business_id AND u.id = access_invites.user_id AND u.active = 1 AND r.active = 1)`
  // Both statements evaluate validity inside the serialized batch. changes()
  // links consumption to the immediately preceding credential write; a loser
  // never overwrites the winner, even when both hashed passwords concurrently.
  const [, consumed] = await db.batch([
    db.prepare(`INSERT INTO user_credentials (business_id, user_id, password_verifier, version, active, password_changed_at, created_at, updated_at)
      SELECT business_id, user_id, ?, 1, 1, ?, ?, ? FROM access_invites WHERE ${eligible}
        AND (purpose = 'reset' OR NOT EXISTS (SELECT 1 FROM user_credentials c
          WHERE c.business_id = access_invites.business_id AND c.user_id = access_invites.user_id AND c.active = 1))
      ON CONFLICT (business_id, user_id) DO UPDATE SET password_verifier = excluded.password_verifier,
        version = 1, active = 1, password_changed_at = excluded.password_changed_at, updated_at = excluded.updated_at`
    ).bind(verifier, timestamp, timestamp, timestamp, tokenHash, timestamp, businessId, businessId),
    db.prepare(`UPDATE access_invites SET consumed_at = ? WHERE ${eligible} AND changes() = 1 RETURNING user_id`
    ).bind(timestamp, tokenHash, timestamp, businessId, businessId),
  ])
  const userId = consumed.results?.[0]?.user_id
  if (!userId) throw invalidInvitation()
  return { userId }
}

export async function acceptAccessInvitation(request, env, businessId) {
  assertSameOriginMutation(request)
  const { token, password } = await readJson(request)
  const result = await consumeAccessInvite(env.DB, { token, password, businessId })
  return json(result, { headers: { 'cache-control': 'no-store' } })
}
