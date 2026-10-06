import { prepareManagementTransaction, prepareManagementCompletion, managementChanged } from './managementTransactions.js'
import { prepareBusinessLifecycleChange } from './businessManagement.js'
import { prepareSessionSnapshotAssertion } from '../identity/sessions.js'
import { commitIdentityStatements } from '../identity/transactions.js'

export async function performBusinessManagement(env,context,target,input,options={}) {
  const db=env.DB,prepared=await prepareManagementTransaction(db,context,target,input,options)
  if (prepared.replay) return prepared.replay
  const action=await prepareBusinessLifecycleChange(db,prepared,target,prepared.input,prepared.commitNow())
  const commitNow=prepared.commitNow()
  prepared.statements[0]=prepareSessionSnapshotAssertion(db,prepared.snapshot,commitNow)
  try {
    await commitIdentityStatements(db,[...prepared.statements,...action.statements,...prepareManagementCompletion(db,prepared,action.result,action.audit,commitNow)])
  } catch (error) {
    if (/CHECK constraint failed|UNIQUE constraint failed/.test(String(error?.message))) {
      const replay=await prepareManagementTransaction(db,context,target,input,options)
      if (replay.replay) return replay.replay
      throw managementChanged()
    }
    throw error
  }
  return action.result
}
