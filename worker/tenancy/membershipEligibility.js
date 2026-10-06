import { prepareIdentityAssertion } from '../identity/transactions.js'

export const ELIGIBLE_MANAGER_SQL = `u.active = 1 AND u.membership_state = 'active' AND a.active = 1 AND a.email_verified_at IS NOT NULL
  AND c.version = 1 AND r.active = 1 AND EXISTS (SELECT 1 FROM role_capabilities rc WHERE rc.business_id = u.business_id AND rc.role_id = u.role_id AND rc.capability = 'access.users.manage')`
export const eligibleManagerSelect = `SELECT u.id FROM users u JOIN accounts a ON a.id=u.account_id JOIN account_credentials c ON c.account_id=a.id
  JOIN roles r ON r.id=u.role_id AND r.business_id=u.business_id WHERE u.business_id=? AND ${ELIGIBLE_MANAGER_SQL}`
export function prepareEligibleManagerAssertion(db,businessId,{excludingUserId=null}={}) {
  return prepareIdentityAssertion(db,crypto.randomUUID(),`SELECT EXISTS(${eligibleManagerSelect} AND (? IS NULL OR u.id!=?))`,[businessId,excludingUserId,excludingUserId])
}

export async function hasEligibleManager(db,businessId,excludingUserId=null) {
  return Boolean(await db.prepare(`${eligibleManagerSelect} AND (? IS NULL OR u.id!=?) LIMIT 1`).bind(businessId,excludingUserId,excludingUserId).first())
}
