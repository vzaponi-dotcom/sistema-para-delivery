import { apiError } from '../http.js'
import { normalizeAccessEmail } from '../../shared/accessEmail.js'
import { isSupportedPasswordVerifier } from './credentials.js'
import { prepareEmailAssertion,clearEmailAssertion,prepareEmailChallenge } from './emailChallenges.js'
import { prepareEmailDeliveryReservation } from './emailThrottle.js'
import { prepareAuditEvent,prepareAuditSelection,withAuditContext } from './audit.js'

const notReady=()=>apiError(409,'STAGING_EMAIL_NOT_READY','A preparação de staging mudou ou o novo gerente ainda não tem acesso confirmado.')
const conflict=()=>apiError(409,'STAGING_EMAIL_CONFLICT','Já existe outra preparação ou conta para este e-mail. Confira o gerente de staging.')
const system=businessId=>({businessId,actorType:'system'})
async function commit(db,statements){
  try{return await db.batch(statements)}catch(error){
    const message=String(error?.message)
    if(message.includes('CHECK constraint failed: ok=1'))throw notReady()
    if(message.includes('UNIQUE constraint failed: users.business_id, users.login_normalized')||message.includes('UNIQUE constraint failed: auth_email_staging_bootstraps.business_id'))throw conflict()
    if(message.includes('NOT NULL constraint failed: auth_email_deliveries.created_at'))throw apiError(429,'EMAIL_DELIVERY_LIMITED','Aguarde 60 segundos antes de reenviar ou confira o limite diário.')
    throw error
  }
}
const managerSelect=`SELECT u.id,u.display_name,u.login_normalized,u.email_verified_at,u.role_id,u.active,
  r.active AS role_active,c.active AS credential_active,c.password_verifier,c.version,c.revision,
  EXISTS(SELECT 1 FROM role_capabilities rc WHERE rc.business_id=r.business_id AND rc.role_id=r.id AND rc.capability='access.users.manage') AS manages
  FROM users u JOIN roles r ON r.business_id=u.business_id AND r.id=u.role_id
  LEFT JOIN user_credentials c ON c.business_id=u.business_id AND c.user_id=u.id WHERE u.business_id=? AND u.id=?`
const usable=user=>user?.active===1&&user.role_active===1&&user.manages===1&&!!user.email_verified_at&&user.credential_active===1&&user.version===1&&isSupportedPasswordVerifier(user.password_verifier)

export async function prepareStagingEmailManager(db,{businessId,name,email,now=new Date(),dailyLimit=80}) {
  email=normalizeAccessEmail(email)
  if(typeof name!=='string'||!name.trim()||Array.from(name.trim()).length>200)throw apiError(400,'INVALID_USER_INPUT','Informe nome válido.')
  const existing=await db.prepare('SELECT * FROM auth_email_staging_bootstraps WHERE business_id=?').bind(businessId).first()
  const userId=existing?.manager_user_id||crypto.randomUUID(),timestamp=now.toISOString()
  const user=existing?await db.prepare(managerSelect).bind(businessId,userId).first():null
  if(existing&&user?.login_normalized!==email)throw conflict()
  if(existing&&user?.email_verified_at){if(!usable(user))throw notReady();return {userId,activated:true}}
  const roleId=user?.role_id||`${businessId}:manager`
  const guardId=crypto.randomUUID()
  const {statements:challengeStatements,...challenge}=await prepareEmailChallenge(db,{businessId,userId,email,roleId,purpose:'activation',now})
  const statements=[prepareEmailAssertion(db,guardId,`SELECT 1 FROM business_auth_state a
    WHERE a.business_id=? AND a.mode='user_only'
    AND EXISTS(SELECT 1 FROM roles r JOIN role_capabilities rc ON rc.business_id=r.business_id AND rc.role_id=r.id AND rc.capability='access.users.manage'
      WHERE r.business_id=a.business_id AND r.id=? AND r.active=1)
    AND ${existing?`EXISTS(SELECT 1 FROM auth_email_staging_bootstraps WHERE business_id=a.business_id AND manager_user_id=? AND finalized_at IS NULL)`:
      `NOT EXISTS(SELECT 1 FROM auth_email_staging_bootstraps WHERE business_id=a.business_id)`}`,[businessId,roleId,...(existing?[userId]:[])])]
  if(!existing)statements.push(
    db.prepare(`INSERT INTO users(id,business_id,display_name,login_normalized,role_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`).bind(userId,businessId,name.trim(),email,roleId,timestamp,timestamp),
    db.prepare(`INSERT INTO auth_email_staging_bootstraps(business_id,manager_user_id,previous_user_ids_json,prepared_at)
      SELECT ?,?,COALESCE(json_group_array(id),'[]'),? FROM users WHERE business_id=? AND id!=?`).bind(businessId,userId,timestamp,businessId,userId),
    prepareAuditEvent(db,system(businessId),{action:'access.email.staging.prepared',resourceType:'user',resourceId:userId,now}),
  )
  statements.push(prepareEmailDeliveryReservation(db,{businessId,userId,challengeId:challenge.challengeId,now,dailyLimit,required:true}),...challengeStatements,clearEmailAssertion(db,guardId))
  await commit(db,statements)
  return {userId,activated:false,displayName:user?.display_name||name.trim(),challenge}
}

export async function finalizeStagingEmailAccounts(db,{businessId,managerId,now=new Date()}) {
  const record=await db.prepare('SELECT * FROM auth_email_staging_bootstraps WHERE business_id=? AND manager_user_id=?').bind(businessId,managerId).first()
  if(!record)throw notReady()
  if(record.finalized_at)return {finalized:true,changed:false,managerId}
  const manager=await db.prepare(managerSelect).bind(businessId,managerId).first()
  if(!usable(manager))throw notReady()
  const guardId=crypto.randomUUID(),timestamp=now.toISOString(),inventory=record.previous_user_ids_json
  const oldUsers=`business_id=? AND id!=? AND id IN (SELECT value FROM json_each(?))`
  const oldCredentials=`business_id=? AND user_id!=? AND user_id IN (SELECT value FROM json_each(?))`
  const values=[businessId,managerId,inventory]
  const systemDb=withAuditContext(db,system(businessId))
  await commit(db,[
    prepareEmailAssertion(db,guardId,`SELECT 1 FROM users u
      JOIN business_auth_state a ON a.business_id=u.business_id AND a.mode='user_only'
      JOIN auth_email_staging_bootstraps b ON b.business_id=u.business_id AND b.manager_user_id=u.id AND b.finalized_at IS NULL AND b.previous_user_ids_json=?
      JOIN roles r ON r.business_id=u.business_id AND r.id=u.role_id AND r.active=1
      JOIN role_capabilities rc ON rc.business_id=r.business_id AND rc.role_id=r.id AND rc.capability='access.users.manage'
      JOIN user_credentials c ON c.business_id=u.business_id AND c.user_id=u.id AND c.active=1 AND c.version=1 AND c.password_verifier=? AND c.revision=?
      WHERE u.business_id=? AND u.id=? AND u.active=1 AND u.email_verified_at IS NOT NULL AND u.login_normalized=?`,[inventory,manager.password_verifier,manager.revision,businessId,managerId,manager.login_normalized]),
    prepareAuditSelection(systemDb,businessId,{action:'access.user.deactivated',resourceType:'user',now},`SELECT id FROM users WHERE ${oldUsers} AND active=1`,values),
    db.prepare(`UPDATE users SET active=0,updated_at=? WHERE ${oldUsers}`).bind(timestamp,...values),
    db.prepare(`UPDATE user_credentials SET active=0,revision=revision+1,updated_at=? WHERE ${oldCredentials}`).bind(timestamp,...values),
    db.prepare(`UPDATE sessions SET revoked_at=? WHERE ${oldCredentials} AND revoked_at IS NULL`).bind(timestamp,...values),
    db.prepare(`UPDATE access_invites SET revoked_at=? WHERE ${oldCredentials} AND revoked_at IS NULL AND consumed_at IS NULL`).bind(timestamp,...values),
    db.prepare(`UPDATE auth_email_challenges SET revoked_at=? WHERE ${oldCredentials} AND revoked_at IS NULL AND consumed_at IS NULL`).bind(timestamp,...values),
    db.prepare('UPDATE auth_email_staging_bootstraps SET finalized_at=? WHERE business_id=? AND manager_user_id=?').bind(timestamp,businessId,managerId),
    prepareAuditEvent(db,system(businessId),{action:'access.email.staging.finalized',resourceType:'business',resourceId:businessId,now}),
    clearEmailAssertion(db,guardId),
  ])
  return {finalized:true,changed:true,managerId}
}
