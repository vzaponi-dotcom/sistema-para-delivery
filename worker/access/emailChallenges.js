import { apiError } from '../http.js'
import { sha256Hex } from '../auth.js'
import { normalizeAccessEmail } from '../../shared/accessEmail.js'
import { hashHumanPassword } from './credentials.js'
import { prepareAuditEvent } from './audit.js'
import { prepareUserSessionRevocation } from './sessions.js'

export const invalidEmailChallenge = () => apiError(400,'INVALID_EMAIL_CHALLENGE','Link inválido ou expirado. Solicite um novo link.')
const system = businessId => ({businessId,actorType:'system'})
const tokenPattern = /^[A-Za-z0-9_-]{43}$/
const randomToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')

// The assertion deliberately aborts the whole D1 transaction on a stale pre-read.
export function prepareEmailAssertion(db,id,predicate,bindings=[]) {
  return db.prepare(`INSERT INTO auth_email_tx_assertions(id,ok) VALUES (?,CASE WHEN EXISTS (${predicate}) THEN 1 ELSE 0 END)`).bind(id,...bindings)
}
export const clearEmailAssertion = (db,id) => db.prepare('DELETE FROM auth_email_tx_assertions WHERE id=?').bind(id)
export async function commitEmailStatements(db,statements) {
  try { return await db.batch(statements) }
  catch(error) {
    if (String(error?.message).includes('CHECK constraint failed: ok=1')) throw invalidEmailChallenge()
    throw error
  }
}

export function prepareEmailChallengeRevocation(db,{businessId,userId,now=new Date()}) {
  return [
    db.prepare('UPDATE auth_email_challenges SET revoked_at=? WHERE business_id=? AND user_id=? AND consumed_at IS NULL AND revoked_at IS NULL').bind(now.toISOString(),businessId,userId),
    prepareAuditEvent(db,system(businessId),{action:'access.email.revoked',resourceType:'user',resourceId:userId,now,onlyIfChanged:true}),
  ]
}
export async function revokeEmailChallenges(db,options) { await db.batch(prepareEmailChallengeRevocation(db,options)) }

export async function issueEmailChallenge(db,{businessId,userId,purpose,issuedBy=null,challengeId=crypto.randomUUID(),now=new Date()}) {
  if (!['activation','password_reset'].includes(purpose)) throw invalidEmailChallenge()
  const row = await db.prepare(`SELECT u.login_normalized,c.revision FROM users u
    LEFT JOIN user_credentials c ON c.business_id=u.business_id AND c.user_id=u.id WHERE u.business_id=? AND u.id=?`).bind(businessId,userId).first()
  if (!row) throw invalidEmailChallenge()
  const email = normalizeAccessEmail(row.login_normalized)
  const revision = purpose==='password_reset' ? row.revision : null
  const eligibility = `SELECT 1 FROM users u JOIN roles r ON r.business_id=u.business_id AND r.id=u.role_id AND r.active=1
    LEFT JOIN user_credentials c ON c.business_id=u.business_id AND c.user_id=u.id
    WHERE u.business_id=? AND u.id=? AND u.login_normalized=? AND u.active=1 AND ${purpose==='activation'
      ? 'u.email_verified_at IS NULL AND (c.user_id IS NULL OR c.active=0)'
      : 'u.email_verified_at IS NOT NULL AND c.active=1 AND c.revision=?'}`
  const token = randomToken(), hash = await sha256Hex(token), timestamp = now.toISOString()
  const expiresAt = new Date(now.getTime()+(purpose==='activation' ? 24*60*60 : 30*60)*1000).toISOString()
  const assertionId = crypto.randomUUID()
  await commitEmailStatements(db,[
    prepareEmailAssertion(db,assertionId,eligibility,[businessId,userId,email,...(purpose==='password_reset' ? [revision] : [])]),
    ...prepareEmailChallengeRevocation(db,{businessId,userId,now}),
    db.prepare(`INSERT INTO auth_email_challenges(id,business_id,user_id,purpose,email,token_hash,expected_revision,issued_by_user_id,created_at,expires_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(challengeId,businessId,userId,purpose,email,hash,revision,issuedBy,timestamp,expiresAt),
    prepareAuditEvent(db,system(businessId),{action:`access.email.${purpose}.issued`,resourceType:'email_challenge',resourceId:challengeId,now}),
    clearEmailAssertion(db,assertionId),
  ])
  return {challengeId,token,email,expiresAt}
}

const challengeSelect = `SELECT h.* FROM auth_email_challenges h
  JOIN users u ON u.business_id=h.business_id AND u.id=h.user_id AND u.active=1 AND u.login_normalized=h.email
  JOIN roles r ON r.business_id=u.business_id AND r.id=u.role_id AND r.active=1
  LEFT JOIN user_credentials c ON c.business_id=u.business_id AND c.user_id=u.id
  WHERE h.business_id=? AND h.token_hash=? AND h.consumed_at IS NULL AND h.revoked_at IS NULL AND h.expires_at>?
  AND ((h.purpose='activation' AND u.email_verified_at IS NULL AND (c.user_id IS NULL OR c.active=0))
    OR (h.purpose='password_reset' AND u.email_verified_at IS NOT NULL AND c.active=1 AND c.revision=h.expected_revision))`

async function loadEligibleChallenge(db,{businessId,token,now}) {
  if (typeof token!=='string' || !tokenPattern.test(token)) throw invalidEmailChallenge()
  const hash = await sha256Hex(token)
  const row = await db.prepare(challengeSelect).bind(businessId,hash,now.toISOString()).first()
  if (!row) throw invalidEmailChallenge()
  return {row,hash}
}
export async function inspectEmailChallenge(db,{businessId,token,now=new Date()}) {
  const {row} = await loadEligibleChallenge(db,{businessId,token,now})
  return {purpose:row.purpose,expiresAt:row.expires_at}
}
export async function completeEmailChallenge(db,{businessId,token,password,now=new Date()}) {
  const {row,hash} = await loadEligibleChallenge(db,{businessId,token,now})
  const verifier = await hashHumanPassword(password), timestamp = now.toISOString(), assertionId = crypto.randomUUID()
  await commitEmailStatements(db,[
    prepareEmailAssertion(db,assertionId,`${challengeSelect} AND h.id=? AND h.user_id=?`,[businessId,hash,timestamp,row.id,row.user_id]),
    db.prepare(`INSERT INTO user_credentials(business_id,user_id,password_verifier,version,revision,active,password_changed_at,created_at,updated_at)
      VALUES (?,?,?,1,1,1,?,?,?) ON CONFLICT(business_id,user_id) DO UPDATE SET password_verifier=excluded.password_verifier,
      version=1,revision=user_credentials.revision+1,active=1,password_changed_at=excluded.password_changed_at,updated_at=excluded.updated_at`)
      .bind(businessId,row.user_id,verifier,timestamp,timestamp,timestamp),
    db.prepare('UPDATE users SET email_verified_at=COALESCE(email_verified_at,?),updated_at=? WHERE business_id=? AND id=?').bind(timestamp,timestamp,businessId,row.user_id),
    db.prepare('UPDATE auth_email_challenges SET consumed_at=? WHERE business_id=? AND id=?').bind(timestamp,businessId,row.id),
    prepareUserSessionRevocation(db,businessId,row.user_id,now),
    prepareAuditEvent(db,system(businessId),{action:'session.revoked',resourceType:'user',resourceId:row.user_id,now,onlyIfChanged:true}),
    ...prepareEmailChallengeRevocation(db,{businessId,userId:row.user_id,now}),
    db.prepare('UPDATE access_invites SET revoked_at=? WHERE business_id=? AND user_id=? AND consumed_at IS NULL AND revoked_at IS NULL').bind(timestamp,businessId,row.user_id),
    prepareAuditEvent(db,system(businessId),{action:`access.email.${row.purpose}.completed`,resourceType:'email_challenge',resourceId:row.id,now}),
    clearEmailAssertion(db,assertionId),
  ])
  return {completed:true,purpose:row.purpose}
}
