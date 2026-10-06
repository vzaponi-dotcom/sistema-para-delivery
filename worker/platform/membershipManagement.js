import { apiError } from '../http.js'
import { prepareIdentityAssertion } from '../identity/transactions.js'
import { eligibleManagerSelect, hasEligibleManager, prepareEligibleManagerAssertion } from '../tenancy/membershipEligibility.js'
import { managementChanged } from './managementTransactions.js'

export async function preparePlatformMembershipChange(db,prepared,target,_input,now) {
  const {company}=prepared
  if (company.lifecycle_status==='deleted') throw managementChanged()
  const member=await db.prepare('SELECT u.*,a.active AS account_active,r.active AS role_active,r.version AS role_version FROM users u JOIN accounts a ON a.id=u.account_id JOIN roles r ON r.id=u.role_id AND r.business_id=u.business_id WHERE u.business_id=? AND u.id=?').bind(company.id,target.userId).first()
  if (!member) throw apiError(404,'USER_NOT_FOUND','Usuário não encontrado.')
  const activate=target.operation==='membership.reactivate'
  if (activate && (member.active!==0 || !['inactive','invited'].includes(member.membership_state) || member.account_active!==1 || member.role_active!==1) || !activate && member.active!==1) throw managementChanged()
  const at=now.toISOString(),statements=[prepareIdentityAssertion(db,crypto.randomUUID(),`SELECT EXISTS(SELECT 1 FROM users u JOIN accounts a ON a.id=u.account_id JOIN roles r ON r.id=u.role_id AND r.business_id=u.business_id
    WHERE u.business_id=? AND u.id=? AND u.account_id=? AND u.role_id=? AND u.active=? AND u.membership_state=? AND r.version=? AND r.active=? AND a.active=?)`,[company.id,member.id,member.account_id,member.role_id,member.active,member.membership_state,member.role_version,member.role_active,member.account_active])]
  if (!activate && company.lifecycle_status==='enabled' && company.access_status==='active' && await db.prepare(`${eligibleManagerSelect} AND u.id=?`).bind(company.id,member.id).first()) {
    if (!await hasEligibleManager(db,company.id,member.id)) throw apiError(409,'LAST_MANAGER','Mantenha pelo menos uma pessoa com permissão para gerenciar a equipe ou suspenda a empresa primeiro.')
    statements.push(prepareEligibleManagerAssertion(db,company.id,{excludingUserId:member.id}))
  }
  const state=member.membership_state==='invited' ? 'invited' : activate ? 'active' : 'inactive'
  statements.push(db.prepare('UPDATE users SET active=?,membership_state=?,updated_at=? WHERE business_id=? AND id=?').bind(activate?1:0,state,at,company.id,member.id),
    db.prepare('UPDATE identity_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE business_id=? AND user_id=?').bind(at,company.id,member.id),
    db.prepare('UPDATE sessions SET revoked_at=COALESCE(revoked_at,?) WHERE business_id=? AND user_id=?').bind(at,company.id,member.id),
    db.prepare('UPDATE company_invitations SET revoked_at=COALESCE(revoked_at,?) WHERE business_id=? AND user_id=? AND consumed_at IS NULL').bind(at,company.id,member.id))
  return {statements,result:{businessId:company.id,operation:target.operation,resourceId:member.id,managementRevision:company.management_revision+1},
    audit:{action:activate?'membership.reactivated':'membership.revoked',resourceType:'user',resourceId:member.id,metadata:{active:activate,membershipState:state}}}
}
