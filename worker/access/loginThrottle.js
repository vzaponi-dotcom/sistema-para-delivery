import { sha256Hex } from '../auth.js'
export const LOGIN_WINDOW_SECONDS = 15 * 60
export const LOGIN_ACCOUNT_LIMIT = 5
export const LOGIN_ORIGIN_LIMIT = 30
// Reserve in one SQL write so concurrent password derivations consume quota.
// Success releases its reservation; earlier failures remain until window expiry.
export async function checkLoginThrottle(db, { businessId, normalizedLogin, originKey, now = new Date() }) {
  const [accountDigest, originDigest] = await Promise.all([
    sha256Hex(`${businessId}\naccount\n${normalizedLogin}`), sha256Hex(`${businessId}\norigin\n${originKey}`),
  ])
  const attemptId = crypto.randomUUID()
  const since = new Date(now.getTime() - LOGIN_WINDOW_SECONDS * 1000).toISOString()
  const result = await db.prepare(`INSERT INTO login_attempts (id,business_id,account_key,origin_key,succeeded,created_at)
    SELECT ?,?,?,?,0,? WHERE
    (SELECT count(*) FROM login_attempts WHERE business_id=? AND account_key=? AND succeeded=0 AND created_at>?) < ?
    AND (SELECT count(*) FROM login_attempts WHERE business_id=? AND origin_key=? AND succeeded=0 AND created_at>?) < ?`)
    .bind(attemptId,businessId,accountDigest,originDigest,now.toISOString(),businessId,accountDigest,since,LOGIN_ACCOUNT_LIMIT,
      businessId,originDigest,since,LOGIN_ORIGIN_LIMIT).run()
  const allowed = result.meta?.changes === 1
  return { allowed, retryAfterSeconds: allowed ? 0 : LOGIN_WINDOW_SECONDS, ...(allowed ? { attemptId } : {}) }
}
export async function completeLoginAttempt(db, attemptId, succeeded) {
  if (succeeded) await db.prepare('UPDATE login_attempts SET succeeded=1 WHERE id=?').bind(attemptId).run()
}
