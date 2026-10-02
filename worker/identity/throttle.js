import { normalizeAccessEmail } from '../../shared/accessEmail.js'
import { sha256Hex } from '../auth.js'
import { apiError } from '../http.js'

const cleanup = (db, table, now) => db.prepare(`DELETE FROM ${table} WHERE id IN
  (SELECT id FROM ${table} WHERE created_at < ? ORDER BY created_at,id LIMIT 100)`)
  .bind(new Date(now.getTime() - 2 * 24 * 60 * 60_000).toISOString())

async function reserve(db, { email, originKey, now = new Date() }, purpose) {
  let normalized = ''
  try { normalized = normalizeAccessEmail(email) } catch { /* Malformed identities share one bucket. */ }
  const recovery = purpose === 'recovery'
  const table = recovery ? 'identity_recovery_requests' : 'identity_login_attempts'
  const accountWindow = (recovery ? 30 : 15) * 60
  const [accountHash, originHash] = await Promise.all([
    sha256Hex(`global\n${purpose}\naccount\n${normalized}`), sha256Hex(`global\n${purpose}\norigin\n${originKey}`),
  ])
  const id = crypto.randomUUID()
  const [result] = await db.batch([
    db.prepare(`INSERT INTO ${table}(id,account_hash,origin_hash,created_at)
      SELECT ?,?,?,? WHERE (SELECT count(*) FROM ${table} WHERE account_hash = ? AND created_at > ?) < ?
      AND (SELECT count(*) FROM ${table} WHERE origin_hash = ? AND created_at > ?) < ?`)
      .bind(id, accountHash, originHash, now.toISOString(), accountHash, new Date(now.getTime() - accountWindow * 1000).toISOString(), recovery ? 3 : 5,
        originHash, new Date(now.getTime() - 15 * 60_000).toISOString(), recovery ? 10 : 30),
    cleanup(db, table, now),
  ])
  const allowed = result.meta?.changes === 1
  return { allowed, ...(allowed ? { attemptId: id } : {}), retryAfterSeconds: allowed ? 0 : accountWindow }
}

export const reserveIdentityLogin = (db, input) => reserve(db, input, 'login')
export const reserveIdentityRecovery = (db, input) => reserve(db, input, 'recovery')
export async function completeIdentityLogin(db, attemptId, succeeded) {
  if (succeeded) await db.prepare('DELETE FROM identity_login_attempts WHERE id = ?').bind(attemptId).run()
}

export function prepareIdentityDeliveryReservation(db, {
  accountId, subjectId, emitterId = null, businessId = null, kind = 'company_invitation', now = new Date(),
  dailyLimit = 80, cooldownSeconds = 60, required = true, emitterLimit = 10, businessLimit = 30,
}) {
  if (![dailyLimit, emitterLimit, businessLimit].every((value) => Number.isSafeInteger(value) && value >= 1)
    || !Number.isSafeInteger(cooldownSeconds) || cooldownSeconds < 0 || !['activation', 'password_reset', 'company_invitation'].includes(kind)) {
    throw apiError(503, 'EMAIL_CONFIG_UNAVAILABLE', 'Envio de e-mail indisponível. Tente novamente mais tarde.')
  }
  const predicate = `NOT EXISTS (SELECT 1 FROM identity_email_deliveries WHERE id = ?)
    AND (SELECT count(*) FROM identity_email_deliveries WHERE created_at >= ?) < ?
    AND NOT EXISTS (SELECT 1 FROM identity_email_deliveries WHERE account_id = ? AND business_id IS ? AND created_at > ?)
    AND (? IS NULL OR ? != 'company_invitation' OR (SELECT count(*) FROM identity_email_deliveries WHERE emitter_id = ? AND kind = 'company_invitation' AND created_at > ?) < ?)
    AND (? IS NULL OR ? != 'company_invitation' OR (SELECT count(*) FROM identity_email_deliveries WHERE business_id = ? AND kind = 'company_invitation' AND created_at > ?) < ?)`
  const since = new Date(now.getTime() - 15 * 60_000).toISOString()
  const values = [subjectId, `${now.toISOString().slice(0, 10)}T00:00:00.000Z`, dailyLimit, accountId, businessId,
    new Date(now.getTime() - cooldownSeconds * 1000).toISOString(), emitterId, kind, emitterId, since, emitterLimit, businessId, kind, businessId, since, businessLimit]
  const columns = 'id,account_id,business_id,emitter_id,kind,created_at'
  return required
    ? db.prepare(`INSERT INTO identity_email_deliveries(${columns}) VALUES (?,?,?,?,?,CASE WHEN ${predicate} THEN ? ELSE NULL END)`)
      .bind(subjectId, accountId, businessId, emitterId, kind, ...values, now.toISOString())
    : db.prepare(`INSERT INTO identity_email_deliveries(${columns}) SELECT ?,?,?,?,?,? WHERE ${predicate}`)
      .bind(subjectId, accountId, businessId, emitterId, kind, now.toISOString(), ...values)
}
