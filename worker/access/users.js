import { apiError } from '../http.js'
import { requireCapability } from '../settingsAccess.js'
import { normalizeLogin, loadRoleGrants } from './roles.js'
import { hashHumanPassword, verifyHumanPassword } from './credentials.js'
import { prepareAccessInvite } from './invitations.js'
import { prepareUserSession, prepareUserSessionRevocation } from './sessions.js'
import { prepareAuditEvent } from './audit.js'
import { prepareEmailChallengeRevocation } from './emailChallenges.js'

const notFound = () => apiError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.')
const roleNotFound = () => apiError(404, 'ROLE_NOT_FOUND', 'Perfil não encontrado.')
const text = (value, field, max) => {
  if (typeof value !== 'string' || !value.trim() || Array.from(value.trim()).length > max) {
    throw apiError(400, 'INVALID_USER_INPUT', `Informe ${field} válido.`)
  }
  return value.trim()
}
const credentialChanged = () => apiError(409, 'CREDENTIAL_CHANGED', 'Seu acesso mudou. Entre novamente antes de alterar a senha.')
const userSelect = `SELECT u.id,u.display_name,u.login_normalized,u.role_id,u.active,r.name AS role_name,
  c.active AS credential_active,
  (SELECT MAX(s.last_seen_at) FROM sessions s WHERE s.business_id=u.business_id AND s.user_id=u.id) AS last_access_at,
  i.purpose AS invite_purpose,i.expires_at AS invite_expires_at
  FROM users u JOIN roles r ON r.business_id=u.business_id AND r.id=u.role_id
  LEFT JOIN user_credentials c ON c.business_id=u.business_id AND c.user_id=u.id
  LEFT JOIN access_invites i ON i.id=(SELECT ai.id FROM access_invites ai WHERE ai.business_id=u.business_id
    AND ai.user_id=u.id AND ai.revoked_at IS NULL AND ai.consumed_at IS NULL ORDER BY ai.created_at DESC,ai.id DESC LIMIT 1)`
function publicUser(row, now) {
  return { id: row.id, displayName: row.display_name, identifier: row.login_normalized,
    roleId: row.role_id, roleName: row.role_name, active: row.active === 1,
    credentialState: row.credential_active === 1 ? 'active' : row.credential_active === 0 ? 'reset_pending' : 'invited',
    lastAccessAt: row.last_access_at,
    invite: row.invite_purpose ? { purpose: row.invite_purpose, expiresAt: row.invite_expires_at,
      status: Date.parse(row.invite_expires_at) > now.getTime() ? 'pending' : 'expired' } : null }
}
async function loadUser(db, businessId, userId, now) {
  const row = await db.prepare(`${userSelect} WHERE u.business_id=? AND u.id=?`).bind(businessId,userId).first()
  if (!row) throw notFound()
  return publicUser(row,now)
}
async function checkRole(db,businessId,roleId) {
  if (typeof roleId !== 'string' || !await db.prepare('SELECT id FROM roles WHERE business_id=? AND id=? AND active=1').bind(businessId,roleId).first()) throw roleNotFound()
}
function event(db,context,action,now,userId) {
  return prepareAuditEvent(db,context,{action,resourceType:'user',resourceId:userId,outcome:'success',now})
}
async function commit(db,statements) {
  try { return await db.batch(statements) }
  catch(error) {
    const message=String(error?.message)
    if(message.includes('NOT NULL constraint failed: users.active')) throw apiError(409,'LAST_MANAGER','Mantenha pelo menos um gerente ativo com senha definida.')
    if(message.includes('NOT NULL constraint failed: users.role_id')) throw roleNotFound()
    if(message.includes('UNIQUE constraint failed: users.business_id, users.login_normalized')) throw apiError(409,'IDENTIFIER_CONFLICT','Este identificador já está em uso.')
    throw error
  }
}

// This predicate counts usable credentials and persisted grants, never invitations
// or a role label. Each batch evaluates it under the serialized write transaction.
const usableManager = (alias) => `${alias}.active=1 AND EXISTS (SELECT 1 FROM user_credentials c
  JOIN roles r ON r.business_id=c.business_id AND r.id=${alias}.role_id AND r.active=1
  JOIN role_capabilities rc ON rc.business_id=r.business_id AND rc.role_id=r.id AND rc.capability='access.users.manage'
  WHERE c.business_id=${alias}.business_id AND c.user_id=${alias}.id AND c.active=1)`
function lastManagerGuard(db,businessId,userId,{active=null,roleId=null,reset=false}={}) {
  // A NULL deliberately fails the existing constraint and aborts every write in
  // the batch. A conditional zero-row UPDATE alone would allow later writes.
  return db.prepare(`UPDATE users SET active=CASE WHEN ${usableManager('users')}
    AND (?=1 OR COALESCE(?,active)=0 OR NOT EXISTS (SELECT 1 FROM roles r JOIN role_capabilities rc
      ON rc.business_id=r.business_id AND rc.role_id=r.id AND rc.capability='access.users.manage'
      WHERE r.business_id=users.business_id AND r.id=COALESCE(?,users.role_id) AND r.active=1))
    AND NOT EXISTS (SELECT 1 FROM users other WHERE other.business_id=users.business_id AND other.id!=users.id AND ${usableManager('other')})
    THEN NULL ELSE active END WHERE business_id=? AND id=?`).bind(reset?1:0,active,roleId,businessId,userId)
}

export async function listUsers(db,context,now=new Date()) {
  requireCapability(context,'access.users.view')
  const {results}=await db.prepare(`${userSelect} WHERE u.business_id=? ORDER BY u.display_name,u.id`).bind(context.businessId).all()
  const {results:roles}=await db.prepare('SELECT id,code,name,active,is_builtin FROM roles WHERE business_id=? ORDER BY code').bind(context.businessId).all()
  const summaries=[]
  for(const role of roles) summaries.push({id:role.id,code:role.code,name:role.name,active:role.active===1,isBuiltin:role.is_builtin===1,
    capabilities:[...await loadRoleGrants(db,context.businessId,role.id)].sort()})
  return {users:results.map(row=>publicUser(row,now)),roles:summaries}
}
export async function createUser(db,context,input,now=new Date()) {
  requireCapability(context,'access.users.manage')
  const businessId=context.businessId,userId=crypto.randomUUID(),timestamp=now.toISOString()
  const displayName=text(input.displayName,'nome',200)
  const identifier=normalizeLogin(text(input.identifier,'identificador',100))
  if(!identifier) throw apiError(400,'INVALID_USER_INPUT','Informe identificador válido.')
  await checkRole(db,businessId,input.roleId)
  const invite=await prepareAccessInvite(db,{businessId,userId,purpose:'activation',issuedBy:context.userId,now})
  await commit(db,[db.prepare(`INSERT INTO users(id,business_id,display_name,login_normalized,role_id,created_at,updated_at)
    VALUES (?,?,?,?,(SELECT id FROM roles WHERE business_id=? AND id=? AND active=1),?,?)`)
    .bind(userId,businessId,displayName,identifier,businessId,input.roleId,timestamp,timestamp),...invite.statements,event(db,context,'access.user.created',now,userId)])
  return {user:await loadUser(db,businessId,userId,now),invite:{token:invite.token,expiresAt:invite.expiresAt}}
}
export async function updateUser(db,context,userId,input,now=new Date()) {
  requireCapability(context,'access.users.manage')
  const businessId=context.businessId
  await loadUser(db,businessId,userId,now)
  const keys=Object.keys(input)
  if(!keys.length || keys.some(key=>!['displayName','roleId','active'].includes(key))) throw apiError(400,'INVALID_USER_PATCH','Informe nome, perfil ou estado ativo.')
  const fields=[],values=[],guard={}
  if(Object.hasOwn(input,'displayName')) {fields.push('display_name=?');values.push(text(input.displayName,'nome',200))}
  if(Object.hasOwn(input,'roleId')) {
    await checkRole(db,businessId,input.roleId)
    fields.push('role_id=(SELECT id FROM roles WHERE business_id=? AND id=? AND active=1)');values.push(businessId,input.roleId);guard.roleId=input.roleId
  }
  if(Object.hasOwn(input,'active')) {
    if(typeof input.active!=='boolean') throw apiError(400,'INVALID_USER_PATCH','Informe estado ativo válido.')
    fields.push('active=?');values.push(input.active?1:0);guard.active=input.active?1:0
  }
  fields.push('updated_at=?');values.push(now.toISOString(),businessId,userId)
  const statements=[lastManagerGuard(db,businessId,userId,guard),db.prepare(`UPDATE users SET ${fields.join(',')} WHERE business_id=? AND id=?`).bind(...values)]
  if(Object.hasOwn(input,'roleId') || Object.hasOwn(input,'active')) statements.push(prepareUserSessionRevocation(db,businessId,userId,now),
    prepareAuditEvent(db,context,{action:'session.revoked',resourceType:'user',resourceId:userId,now,onlyIfChanged:true}))
  if(input.active===false) statements.push(...prepareEmailChallengeRevocation(db,{businessId,userId,now}))
  if(Object.hasOwn(input,'roleId')) statements.push(event(db,context,'access.user.role-changed',now,userId))
  if(Object.hasOwn(input,'active')) statements.push(event(db,context,input.active?'access.user.activated':'access.user.deactivated',now,userId))
  if(Object.hasOwn(input,'displayName')) statements.push(event(db,context,'access.user.updated',now,userId))
  await commit(db,statements)
  return {user:await loadUser(db,businessId,userId,now)}
}
export async function requestCredentialReset(db,context,userId,now=new Date()) {
  requireCapability(context,'access.users.manage')
  const businessId=context.businessId
  await loadUser(db,businessId,userId,now)
  if(userId===context.userId) throw apiError(403,'OWN_RESET_FORBIDDEN','Para mudar sua senha, informe a senha atual em Minha conta.')
  const invite=await prepareAccessInvite(db,{businessId,userId,purpose:'reset',issuedBy:context.userId,now})
  // Reset preparation places the session UPDATE immediately before invite INSERT.
  invite.statements.splice(invite.statements.length-1,0,prepareAuditEvent(db,context,{action:'session.revoked',resourceType:'user',resourceId:userId,now,onlyIfChanged:true}))
  await commit(db,[lastManagerGuard(db,businessId,userId,{reset:true}),...invite.statements,event(db,context,'access.password.reset',now,userId)])
  return {user:await loadUser(db,businessId,userId,now),invite:{token:invite.token,expiresAt:invite.expiresAt}}
}
export async function changeOwnPassword(db,context,input,now=new Date()) {
  if(!context?.userId || context.legacy) throw apiError(403,'FORBIDDEN','Entre com uma conta individual para alterar sua senha.')
  const businessId=context.businessId,userId=context.userId
  const credential=await db.prepare('SELECT password_verifier FROM user_credentials WHERE business_id=? AND user_id=? AND active=1').bind(businessId,userId).first()
  if(!credential || !await verifyHumanPassword(input.currentPassword,credential.password_verifier)) throw apiError(400,'CURRENT_PASSWORD_INVALID','Senha atual inválida.')
  const verifier=await hashHumanPassword(input.password),timestamp=now.toISOString()
  const session=await prepareUserSession(db,{businessId,userId,deviceMode:context.deviceMode,credentialVerifier:verifier,now})
  try {
    await db.batch([
      db.prepare(`UPDATE user_credentials SET password_verifier=CASE WHEN active=1 AND password_verifier=? AND EXISTS
        (SELECT 1 FROM sessions WHERE business_id=? AND id=? AND user_id=? AND revoked_at IS NULL AND expires_at>?)
        THEN ? ELSE NULL END,revision=revision+1,password_changed_at=?,updated_at=? WHERE business_id=? AND user_id=?`)
        .bind(credential.password_verifier,businessId,context.sessionId,userId,timestamp,verifier,timestamp,timestamp,businessId,userId),
      prepareUserSessionRevocation(db,businessId,userId,now),
      ...prepareEmailChallengeRevocation(db,{businessId,userId,now}),
      prepareAuditEvent(db,context,{action:'session.revoked',resourceType:'user',resourceId:userId,now,onlyIfChanged:true}),session.statement,
      event(db,{...context,sessionId:session.sessionId},'access.password.changed',now,userId),
    ])
  } catch(error) {
    if(String(error?.message).includes('NOT NULL constraint failed: user_credentials.password_verifier') || String(error?.message).includes('FOREIGN KEY constraint failed')) throw credentialChanged()
    throw error
  }
  return {token:session.token,expiresAt:session.expiresAt}
}
