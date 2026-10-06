import { apiError } from '../http.js'
import { prepareKitchenTvAccessRevocation } from '../kitchenTvRepository.js'
import { hasEligibleManager, prepareEligibleManagerAssertion } from '../tenancy/membershipEligibility.js'
import { managementChanged } from './managementTransactions.js'

export async function prepareBusinessLifecycleChange(db,prepared,target,input,now) {
  const {company}=prepared,from=company.lifecycle_status
  const transitions={suspend:{allowed:['enabled'],to:'suspended',action:'business.suspended'},resume:{allowed:['suspended'],to:'enabled',action:'business.resumed'},delete:{allowed:['enabled','suspended'],to:'deleted',action:'business.deleted'},restore:{allowed:['deleted'],to:'suspended',action:'business.restored'}}
  const transition=transitions[target.operation]
  if (!transition || !transition.allowed.includes(from)) throw managementChanged()
  if (target.operation==='delete' && input.confirmationName!==company.name.trim().normalize('NFC')) throw apiError(400,'INVALID_COMPANY_CONFIRMATION','Digite o nome atual da empresa para confirmar.')
  const statements=[]
  if (target.operation==='resume' && company.access_status==='active') {
    if (!await hasEligibleManager(db,company.id)) throw apiError(409,'LAST_MANAGER','Reative pelo menos uma pessoa com permissão para gerenciar a equipe antes de liberar a empresa.')
    statements.push(prepareEligibleManagerAssertion(db,company.id))
  }
  statements.push(db.prepare('UPDATE businesses SET lifecycle_status=? WHERE id=?').bind(transition.to,company.id))
  if (['suspend','delete'].includes(target.operation)) {
    const at=now.toISOString()
    statements.push(db.prepare('UPDATE identity_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE business_id=?').bind(at,company.id),
      db.prepare('UPDATE sessions SET revoked_at=COALESCE(revoked_at,?) WHERE business_id=?').bind(at,company.id),
      db.prepare('UPDATE company_invitations SET revoked_at=COALESCE(revoked_at,?) WHERE business_id=? AND consumed_at IS NULL').bind(at,company.id),
      ...prepareKitchenTvAccessRevocation(db,company.id,now))
  }
  return {statements,result:{businessId:company.id,operation:target.operation,resourceId:company.id,managementRevision:company.management_revision+1},
    audit:{action:transition.action,resourceType:'business',resourceId:company.id,metadata:{from,to:transition.to,accessStatus:company.access_status}}}
}
