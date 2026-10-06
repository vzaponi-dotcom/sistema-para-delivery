import { apiError } from '../http.js'
import { prepareIdentityAssertion } from '../identity/transactions.js'
import { readEmailConfig } from '../access/emailDelivery.js'
import { prepareMembershipInvitation } from '../tenancy/companyInvitations.js'
import { managementChanged } from './managementTransactions.js'

export async function preparePlatformInvitationChange(env,prepared,target,_input,options={}) {
  const db=env.DB,{company}=prepared,now=prepared.commitNow()
  if (company.lifecycle_status==='deleted' || target.operation==='invitation.resend' && company.lifecycle_status!=='enabled') throw managementChanged()
  const invite=await db.prepare('SELECT h.*,u.display_name,u.active AS member_active,u.membership_state,u.role_id AS current_role_id FROM company_invitations h JOIN users u ON u.id=h.user_id AND u.business_id=h.business_id WHERE h.business_id=? AND h.id=?').bind(company.id,target.invitationId).first()
  if (!invite) throw apiError(404,'INVITATION_NOT_FOUND','Convite não encontrado.')
  if (invite.consumed_at) throw managementChanged()
  const result={businessId:company.id,operation:target.operation,resourceId:invite.id,managementRevision:company.management_revision+1}
  if (target.operation==='invitation.cancel') {
    if (invite.revoked_at) throw managementChanged()
    return {statements:[prepareIdentityAssertion(db,crypto.randomUUID(),'SELECT EXISTS(SELECT 1 FROM company_invitations WHERE id=? AND business_id=? AND consumed_at IS NULL AND revoked_at IS NULL)',[invite.id,company.id]),db.prepare('UPDATE company_invitations SET revoked_at=? WHERE business_id=? AND id=?').bind(now.toISOString(),company.id,invite.id)],result,
      audit:{action:'invitation.cancelled',resourceType:'invitation',resourceId:invite.id}}
  }
  if (invite.member_active!==1 || invite.membership_state!=='invited') throw apiError(409,'MEMBERSHIP_INACTIVE','Permita um novo convite para este vínculo antes de reenviar.')
  const config=readEmailConfig(env)
  const next=await prepareMembershipInvitation(db,{businessId:company.id,accountEmail:invite.email_normalized,displayName:invite.display_name,roleId:invite.current_role_id,issuer:prepared.context,purpose:invite.purpose,userId:invite.user_id,
    expectedInvitationId:invite.id,issuerCapability:'platform.invitations.resend',auditOwner:'management',dailyLimit:config.dailyLimit,now,monotonicNow:options.monotonicNow})
  return {statements:next.statements,result:{...result,invitationId:next.value.invitationId,userId:next.value.userId,expiresAt:next.value.expiresAt},deliveryMessage:next.value,
    audit:{action:'invitation.resent',resourceType:'invitation',resourceId:next.value.invitationId}}
}

export async function projectInvitationDelivery(db,result) {
  if (!result.invitationId) return result
  const row=await db.prepare('SELECT delivery_status FROM company_invitations WHERE business_id=? AND id=?').bind(result.businessId,result.invitationId).first()
  return {...result,delivery:{status:row?.delivery_status || 'uncertain'}}
}
