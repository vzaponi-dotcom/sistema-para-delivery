import { deliverEmailChallenge } from '../access/emailDelivery.js'
import { prepareIdentityAudit } from './audit.js'

export function deliverIdentityMessage(env, { subjectId, ...message }, options) {
  return deliverEmailChallenge(env, { ...message, challengeId: subjectId, globalIdentity: true }, options)
}

export async function deliverPersistedIdentityMessage(db, env, message, { fetchImpl = fetch, now = new Date() } = {}) {
  let result
  try { result = await deliverIdentityMessage(env, message, { fetchImpl }) } catch { result = { status: 'uncertain' } }
  const status = ['accepted', 'rejected', 'uncertain'].includes(result?.status) ? result.status : 'uncertain'
  const providerId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(result?.providerId || '') ? result.providerId : null
  await db.batch([
    db.prepare("UPDATE identity_challenges SET delivery_status = ?,provider_id = ?,revoked_at = CASE WHEN ? = 'rejected' THEN COALESCE(revoked_at,?) ELSE revoked_at END WHERE id = ? AND account_id = ?")
      .bind(status, providerId, status, now.toISOString(), message.subjectId, message.accountId),
    prepareIdentityAudit(db, { accountId: message.accountId, action: `challenge.delivery.${status}`, result: status === 'accepted' ? 'success' : 'failure', now }),
  ])
  return { status, ...(providerId ? { providerId } : {}) }
}
