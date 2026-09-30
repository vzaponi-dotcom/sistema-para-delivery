import { apiError } from '../http.js'
import { BUILTIN_ROLES, normalizeLogin, prepareBuiltinRoles } from './roles.js'
import { isSupportedPasswordVerifier } from './credentials.js'
import { prepareAccessInvite } from './invitations.js'
import { prepareAuditEvent } from './audit.js'
import { APPLICATION_CAPABILITIES } from '../../shared/settingsAccess.js'

const failed = () => apiError(409,'ACCESS_TRANSITION_NOT_READY','Estado de acesso incompatível. Execute o preflight e confira a conta.')
const event = (db,businessId,action,resourceId,now,onlyIfChanged=false) => prepareAuditEvent(db,{businessId,actorType:'system'},
  {action,resourceType:action.startsWith('access.auth.')?'business':'user',resourceId,now,onlyIfChanged})

// Existing NOT NULL is a transaction assertion, including when state is missing.
// Never implement this as a zero-row UPDATE followed by unguarded writes.
function guard(db,businessId,predicate,values,now) {
  return db.prepare(`INSERT INTO business_auth_state(business_id,mode,created_at,updated_at)
    VALUES (?,CASE WHEN (${predicate}) THEN (SELECT mode FROM business_auth_state WHERE business_id=?) ELSE NULL END,?,?)
    ON CONFLICT(business_id) DO UPDATE SET mode=excluded.mode`)
    .bind(businessId,...values,businessId,now.toISOString(),now.toISOString())
}
async function commit(db,statements) {
  try { await db.batch(statements) }
  catch(error) {
    if(String(error?.message).includes('NOT NULL constraint failed: business_auth_state.mode')) throw failed()
    throw error
  }
}
async function credentialSnapshot(db,businessId) {
  const {results}=await db.prepare('SELECT user_id,password_verifier,version FROM user_credentials WHERE business_id=?').bind(businessId).all()
  return JSON.stringify(results.filter(c=>c.version===1 && isSupportedPasswordVerifier(c.password_verifier)))
}
const expectedGrants=JSON.stringify(BUILTIN_ROLES.flatMap(role=>role.capabilities.map(capability=>({code:role.code,capability}))))
// JS checks canonical encoding; SQL rechecks the exact approved verifier and
// version within the same transaction as all official writes. A concurrent
// password change conservatively requires a fresh preflight, never stale approval.
const approvedCredential = `EXISTS (SELECT 1 FROM json_each(?) approved
  WHERE json_extract(approved.value,'$.user_id')=c.user_id
  AND json_extract(approved.value,'$.password_verifier')=c.password_verifier) AND c.version=1`
const readinessSql=`SELECT
  EXISTS (SELECT 1 FROM users u JOIN roles r ON r.business_id=u.business_id AND r.id=u.role_id
    JOIN user_credentials c ON c.business_id=u.business_id AND c.user_id=u.id
    JOIN role_capabilities rc ON rc.business_id=r.business_id AND rc.role_id=r.id AND rc.capability='access.users.manage'
    WHERE u.business_id=? AND u.active=1 AND r.active=1 AND c.active=1 AND ${approvedCredential}) AS manager_ready,
  NOT EXISTS (SELECT 1 FROM users u LEFT JOIN roles r ON r.business_id=u.business_id AND r.id=u.role_id
    LEFT JOIN user_credentials c ON c.business_id=u.business_id AND c.user_id=u.id
    WHERE u.business_id=? AND u.active=1 AND (r.id IS NULL OR r.active!=1 OR c.user_id IS NULL OR c.active!=1 OR NOT (${approvedCredential}))) AS credentials_ready,
  NOT EXISTS (SELECT 1 FROM json_each(?) expected WHERE NOT EXISTS
    (SELECT 1 FROM roles r JOIN role_capabilities rc ON rc.business_id=r.business_id AND rc.role_id=r.id
     WHERE r.business_id=? AND r.active=1 AND r.code=json_extract(expected.value,'$.code')
       AND rc.capability=json_extract(expected.value,'$.capability')))
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.business_id=? AND u.active=1 AND NOT EXISTS
      (SELECT 1 FROM role_capabilities rc JOIN json_each(?) known ON known.value=rc.capability
        WHERE rc.business_id=u.business_id AND rc.role_id=u.role_id))
    AND NOT EXISTS (SELECT 1 FROM roles r JOIN role_capabilities rc ON rc.business_id=r.business_id AND rc.role_id=r.id
      JOIN json_each(?) known ON known.value=rc.capability
      WHERE r.business_id=? AND r.code IN ('manager','operator') AND NOT EXISTS
      (SELECT 1 FROM json_each(?) expected WHERE json_extract(expected.value,'$.code')=r.code
        AND json_extract(expected.value,'$.capability')=rc.capability)) AS grants_ready`
const knownGrants=JSON.stringify(APPLICATION_CAPABILITIES)
const readinessValues=(businessId,snapshot)=>[businessId,snapshot,businessId,snapshot,expectedGrants,businessId,businessId,knownGrants,knownGrants,businessId,expectedGrants]

export async function preflightCutover(db,businessId) {
  const snapshot=await credentialSnapshot(db,businessId)
  const row=await db.prepare(readinessSql).bind(...readinessValues(businessId,snapshot)).first()
  const state=await db.prepare('SELECT mode FROM business_auth_state WHERE business_id=?').bind(businessId).first()
  const failures=[]
  if(!['enrollment','user_only'].includes(state?.mode)) failures.push('AUTH_MODE_NOT_ENROLLED')
  if(!row.manager_ready) failures.push('NO_USABLE_MANAGER')
  if(!row.credentials_ready) failures.push('INCOMPLETE_CREDENTIALS_OR_ROLES')
  if(!row.grants_ready) failures.push('INCOMPLETE_BUILTIN_GRANTS')
  return {ready:failures.length===0,failures}
}

export async function cutoverBusinessAuth(db,businessId,now=new Date()) {
  const snapshot=await credentialSnapshot(db,businessId)
  await commit(db,[
    guard(db,businessId,`EXISTS (SELECT 1 FROM business_auth_state WHERE business_id=? AND
      (mode='user_only' OR (mode='enrollment' AND (SELECT manager_ready AND credentials_ready AND grants_ready FROM (${readinessSql})))) )`,
      [businessId,...readinessValues(businessId,snapshot)],now),
    db.prepare("UPDATE business_auth_state SET mode='user_only',cutover_at=?,updated_at=? WHERE business_id=? AND mode='enrollment'")
      .bind(now.toISOString(),now.toISOString(),businessId),
    // changes() must observe the transition itself, before legacy revocations.
    event(db,businessId,'access.auth.cutover',businessId,now,true),
    db.prepare('UPDATE sessions SET revoked_at=? WHERE business_id=? AND user_id IS NULL AND revoked_at IS NULL').bind(now.toISOString(),businessId),
  ])
}

export async function issueInitialManager(db,businessId,{identifier,displayName},now=new Date()) {
  if(typeof identifier!=='string' || !identifier.trim() || identifier.length>100 || typeof displayName!=='string' || !displayName.trim() || displayName.length>200) throw failed()
  const login=normalizeLogin(identifier),userId=`${businessId}:initial-manager`,timestamp=now.toISOString()
  const invite=await prepareAccessInvite(db,{businessId,userId,purpose:'activation',now})
  await commit(db,[
    guard(db,businessId,`EXISTS (SELECT 1 FROM business_auth_state WHERE business_id=? AND mode IN ('legacy','enrollment'))
      AND NOT EXISTS (SELECT 1 FROM users WHERE business_id=? AND (id!=? OR login_normalized!=? OR active!=1 OR role_id!=?))
      AND NOT EXISTS (SELECT 1 FROM user_credentials WHERE business_id=?)`,[businessId,businessId,userId,login,`${businessId}:manager`,businessId],now),
    ...prepareBuiltinRoles(db,businessId,now),
    db.prepare(`INSERT INTO users(id,business_id,display_name,login_normalized,role_id,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(business_id,id) DO NOTHING`).bind(userId,businessId,displayName.trim(),login,`${businessId}:manager`,timestamp,timestamp),
    db.prepare("UPDATE business_auth_state SET mode='enrollment',updated_at=? WHERE business_id=? AND mode='legacy'").bind(timestamp,businessId),
    event(db,businessId,'access.auth.enrollment',businessId,now,true),
    ...invite.statements,event(db,businessId,'access.invitation.initial',userId,now),
  ])
  return {userId,token:invite.token,expiresAt:invite.expiresAt}
}

export async function issueEmergencyInvite(db,businessId,userId,now=new Date()) {
  const snapshot=await credentialSnapshot(db,businessId)
  const invite=await prepareAccessInvite(db,{businessId,userId,purpose:'reset',now})
  await commit(db,[
    guard(db,businessId,`EXISTS (SELECT 1 FROM business_auth_state WHERE business_id=? AND mode IN ('enrollment','user_only'))
      AND EXISTS (SELECT 1 FROM users u JOIN roles r ON r.business_id=u.business_id AND r.id=u.role_id
      JOIN role_capabilities rc ON rc.business_id=r.business_id AND rc.role_id=r.id AND rc.capability='access.users.manage'
      JOIN user_credentials c ON c.business_id=u.business_id AND c.user_id=u.id
      WHERE u.business_id=? AND u.id=? AND u.active=1 AND r.active=1 AND ${approvedCredential})`,[businessId,businessId,userId,snapshot],now),
    ...invite.statements,event(db,businessId,'access.invitation.emergency',userId,now),
  ])
  return {userId,token:invite.token,expiresAt:invite.expiresAt}
}
