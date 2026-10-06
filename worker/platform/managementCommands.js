import { prepareManagementTransaction, prepareManagementCompletion, managementChanged } from './managementTransactions.js'
import { prepareBusinessLifecycleChange } from './businessManagement.js'
import { preparePlatformMembershipChange } from './membershipManagement.js'
import { preparePlatformInvitationChange, projectInvitationDelivery } from './invitationManagement.js'
import { deliverPersistedCompanyInvitation } from '../tenancy/companyInvitations.js'
import { apiError } from '../http.js'
import { prepareSessionSnapshotAssertion } from '../identity/sessions.js'
import { commitIdentityStatements } from '../identity/transactions.js'

export async function performBusinessManagement(env,context,target,input,options={}) {
  const db=env.DB,prepared=await prepareManagementTransaction(db,context,target,input,options)
  if (prepared.replay) return projectInvitationDelivery(db,prepared.replay)
  const action=target.operation.startsWith('membership.') ? await preparePlatformMembershipChange(db,prepared,target,prepared.input,prepared.commitNow())
    : target.operation.startsWith('invitation.') ? await preparePlatformInvitationChange(env,prepared,target,prepared.input,options)
      : await prepareBusinessLifecycleChange(db,prepared,target,prepared.input,prepared.commitNow())
  const commitNow=prepared.commitNow()
  prepared.statements[0]=prepareSessionSnapshotAssertion(db,prepared.snapshot,commitNow)
  try {
    await commitIdentityStatements(db,[...prepared.statements,...action.statements,...prepareManagementCompletion(db,prepared,action.result,action.audit,commitNow)])
  } catch (error) {
    if (/NOT NULL constraint failed: identity_email_deliveries.created_at/.test(String(error?.message))) throw apiError(429,'EMAIL_DELIVERY_LIMITED','Aguarde pelo menos 60 segundos e confira o limite diário do ambiente.')
    if (/CHECK constraint failed|UNIQUE constraint failed/.test(String(error?.message))) {
      const replay=await prepareManagementTransaction(db,context,target,input,options)
      if (replay.replay) return projectInvitationDelivery(db,replay.replay)
      throw managementChanged()
    }
    throw error
  }
  if (action.deliveryMessage) await deliverPersistedCompanyInvitation(db,env,action.deliveryMessage,{...options,now:commitNow})
  return projectInvitationDelivery(db,action.result)
}
