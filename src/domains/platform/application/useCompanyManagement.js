import { useState, useSyncExternalStore } from 'react'
import { createManagementAttempts } from './managementAttempts.js'

export function useCompanyManagement({accountId,contextId,businessId,api,attempts:supplied}) {
  const [local]=useState(createManagementAttempts),attempts=supplied||local
  const attempt=useSyncExternalStore(attempts.subscribe,()=>attempts.getSnapshot(accountId))
  return {attempt,pending:attempt?.status==='pending',blocked:attempts.isBlocking(accountId),
    execute:(target,input)=>attempts.execute({accountId,contextId,target:{businessId,...target},input,api}),
    reconcile:()=>attempts.reconcile({accountId,api}),retry:()=>attempts.retryConfirmedAttempt({accountId,api}),
    acknowledge:()=>{const value=attempts.getSnapshot(accountId);if(value) attempts.acknowledge(accountId,value.key)},
  }
}
