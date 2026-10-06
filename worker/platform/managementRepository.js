import { apiError } from '../http.js'
import { loadEligibleManagers } from '../tenancy/membershipEligibility.js'
import { validManagementKey } from './managementTransactions.js'
import { projectInvitationDelivery } from './invitationManagement.js'

async function companyRow(db,businessId) {
  const row=await db.prepare('SELECT id,access_status,lifecycle_status,management_revision FROM businesses WHERE id=?').bind(businessId).first()
  if (!row) throw apiError(404,'BUSINESS_NOT_FOUND','Empresa não encontrada.')
  return row
}

export async function listPlatformMemberships(db,businessId,now=new Date()) {
  const company=await companyRow(db,businessId),managers=await loadEligibleManagers(db,businessId),ids=new Set(managers.map(m=>m.id))
  const {results}=await db.prepare(`SELECT u.id,u.display_name,u.active,u.membership_state,u.role_id,r.name AS role_name,r.active AS role_active,a.email_normalized,a.active AS account_active,
    h.id AS invite_id,h.purpose,h.expires_at,h.delivery_status,h.revoked_at,h.consumed_at FROM users u JOIN accounts a ON a.id=u.account_id
    JOIN roles r ON r.id=u.role_id AND r.business_id=u.business_id LEFT JOIN company_invitations h ON h.id=(SELECT id FROM company_invitations WHERE business_id=u.business_id AND user_id=u.id ORDER BY created_at DESC,id DESC LIMIT 1)
    WHERE u.business_id=? ORDER BY u.display_name,u.id`).bind(businessId).all()
  const editable=company.lifecycle_status!=='deleted',enabled=company.lifecycle_status==='enabled'
  return {managementRevision:company.management_revision,users:results.map(row=>({id:row.id,displayName:row.display_name,email:row.email_normalized,roleId:row.role_id,roleName:row.role_name,active:row.active===1,membershipState:row.membership_state,
    invitation:row.invite_id ? {id:row.invite_id,purpose:row.purpose,expiresAt:row.expires_at,deliveryStatus:row.delivery_status,status:row.consumed_at ? 'accepted' : row.revoked_at ? 'revoked' : Date.parse(row.expires_at)<=now.getTime() ? 'expired' : 'pending'} : null,
    canRevoke:editable && row.active===1 && !(enabled && company.access_status==='active' && ids.has(row.id) && ids.size===1),
    canReactivate:editable && row.active===0 && ['inactive','invited'].includes(row.membership_state) && row.role_active===1 && row.account_active===1,
    canCancelInvitation:editable && Boolean(row.invite_id) && !row.consumed_at && !row.revoked_at,
    canResendInvitation:enabled && row.active===1 && row.membership_state==='invited' && row.role_active===1 && Boolean(row.invite_id) && !row.consumed_at && company.access_status===(row.purpose==='first_manager'?'pending':'active'),
  }))}
}

const invalidPage=()=>apiError(400,'INVALID_HISTORY_PAGE','Página do histórico inválida.')
const encode=value=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
export async function listPlatformHistory(db,businessId,{cursor=null,limit=20}={}) {
  await companyRow(db,businessId)
  if (!Number.isSafeInteger(Number(limit)) || Number(limit)<1 || Number(limit)>50) throw invalidPage()
  const values=[businessId],clauses=['h.business_id=?']
  if (cursor!==null) {
    try {
      if (typeof cursor!=='string' || cursor.length>2000 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw invalidPage()
      const page=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(cursor.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))))
      if (Object.keys(page).sort().join(',')!=='businessId,createdAt,id' || page.businessId!==businessId || typeof page.id!=='string' || !page.id || page.id.length>200 || typeof page.createdAt!=='string' || !Number.isFinite(Date.parse(page.createdAt))) throw invalidPage()
      clauses.push('(h.created_at<? OR (h.created_at=? AND h.id<?))');values.push(page.createdAt,page.createdAt,page.id)
    } catch {throw invalidPage()}
  }
  const {results}=await db.prepare(`SELECT h.id,h.action,h.result,h.created_at,h.reason,h.resource_type,h.resource_id,a.display_name AS actor_name,CASE WHEN h.resource_type='user' THEN (SELECT display_name FROM users WHERE business_id=h.business_id AND id=h.resource_id) WHEN h.resource_type='invitation' THEN (SELECT email_normalized FROM company_invitations WHERE business_id=h.business_id AND id=h.resource_id) ELSE (SELECT name FROM businesses WHERE id=h.business_id) END AS resource_label FROM platform_audit_events h LEFT JOIN accounts a ON a.id=h.account_id WHERE ${clauses.join(' AND ')} ORDER BY h.created_at DESC,h.id DESC LIMIT ?`).bind(...values,Number(limit)+1).all()
  const rows=results.slice(0,Number(limit)),last=rows.at(-1)
  return {items:rows.map(r=>({id:r.id,action:r.action,result:r.result,occurredAt:r.created_at,reason:r.reason,actorName:r.actor_name||null,resourceType:r.resource_type,resourceId:r.resource_id,resourceLabel:r.resource_label||null})),nextCursor:results.length>Number(limit)?encode({businessId,createdAt:last.created_at,id:last.id}):null}
}

export async function getPlatformManagementAttempt(db,accountId,businessId,key) {
  if (!validManagementKey(key)) throw apiError(400,'INVALID_IDEMPOTENCY_KEY','Tentativa inválida.')
  const row=await db.prepare('SELECT result_json FROM platform_management_receipts WHERE account_id=? AND business_id=? AND idempotency_key=?').bind(accountId,businessId,key).first()
  if (!row) throw apiError(404,'MANAGEMENT_ATTEMPT_NOT_FOUND','Não foi possível confirmar esta tentativa ainda.')
  return {status:'confirmed',result:await projectInvitationDelivery(db,JSON.parse(row.result_json))}
}
