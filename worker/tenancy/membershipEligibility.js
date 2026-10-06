import { prepareIdentityAssertion } from '../identity/transactions.js'
import { isSupportedPasswordVerifier } from '../access/credentials.js'

export const ELIGIBLE_MANAGER_SQL = `u.active = 1 AND u.membership_state = 'active' AND a.active = 1 AND a.email_verified_at IS NOT NULL
  AND c.version = 1 AND r.active = 1 AND EXISTS (SELECT 1 FROM role_capabilities rc WHERE rc.business_id = u.business_id AND rc.role_id = u.role_id AND rc.capability = 'access.users.manage')`
export const eligibleManagerSelect = `SELECT u.id,c.password_verifier AS credential_verifier FROM users u JOIN accounts a ON a.id=u.account_id JOIN account_credentials c ON c.account_id=a.id
  JOIN roles r ON r.id=u.role_id AND r.business_id=u.business_id WHERE u.business_id=? AND ${ELIGIBLE_MANAGER_SQL}`
export async function loadEligibleManagers(db,businessId,excludingUserId=null) {
  const {results}=await db.prepare(`${eligibleManagerSelect} AND (? IS NULL OR u.id!=?)`).bind(businessId,excludingUserId,excludingUserId).all()
  return results.filter(row=>isSupportedPasswordVerifier(row.credential_verifier))
}

export async function prepareEligibleManagerAssertion(db,businessId,{excludingUserId=null}={}) {
  const candidates=await loadEligibleManagers(db,businessId,excludingUserId)
  if (!candidates.length) return prepareIdentityAssertion(db,crypto.randomUUID(),'SELECT 0')
  return prepareIdentityAssertion(db,crypto.randomUUID(),`SELECT EXISTS(${eligibleManagerSelect} AND (${candidates.map(()=>'(u.id=? AND c.password_verifier=?)').join(' OR ')}))`,[businessId,...candidates.flatMap(row=>[row.id,row.credential_verifier])])
}

export async function hasEligibleManager(db,businessId,excludingUserId=null) {
  return (await loadEligibleManagers(db,businessId,excludingUserId)).length>0
}
