export function createManagementAttempts() {
  const attempts=new Map(),listeners=new Set()
  const publish=(accountId,value)=>{attempts.set(accountId,Object.freeze(value));for(const listener of listeners) listener()}
  const write=async(accountId,attempt,api)=>{
    publish(accountId,{...attempt,status:'pending',error:'',notFound:false})
    try {
      const result=await api.manageBusiness(attempt.target,attempt.input,attempt.key)
      if(!result?.businessId) throw new Error('Resultado não confirmado.')
      publish(accountId,{...attempt,status:'confirmed',result,error:'',notFound:false})
      return result
    } catch(error) {
      const definitive=Number.isInteger(error?.status) && error.status>=400 && error.status<500 && (error.status!==409 || ['BUSINESS_MANAGEMENT_CHANGED','LAST_MANAGER','MEMBERSHIP_INACTIVE','INVITATION_CHANGED'].includes(error.code))
      publish(accountId,{...attempt,status:definitive?'rejected':'uncertain',error:definitive?error.message:'Não foi possível confirmar esta ação. Verifique o resultado antes de tentar novamente.',notFound:false})
      return null
    }
  }
  return {
    subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener)},
    getSnapshot(accountId){return attempts.get(accountId)||null},
    isBlocking(accountId){return ['pending','uncertain'].includes(attempts.get(accountId)?.status)},
    hasUnresolved(){return [...attempts.values()].some(a=>['pending','uncertain'].includes(a.status))},
    async execute({accountId,contextId,target,input,api}){
      if(!accountId || !contextId || ['pending','uncertain'].includes(attempts.get(accountId)?.status)) return null
      return write(accountId,{accountId,contextId,key:crypto.randomUUID(),target:Object.freeze({...target}),input:Object.freeze({...input})},api)
    },
    async reconcile({accountId,api}){
      const attempt=attempts.get(accountId)
      if(attempt?.status!=='uncertain') return null
      publish(accountId,{...attempt,status:'pending'})
      try {
        const view=await api.getManagementAttempt(attempt.target.businessId,attempt.key)
        if(view?.status!=='confirmed' || !view.result?.businessId) throw new Error('Resultado não confirmado.')
        publish(accountId,{...attempt,status:'confirmed',result:view.result,error:'',notFound:false})
        return view.result
      } catch(error) {
        const denied=[401,403].includes(error?.status)
        publish(accountId,{...attempt,status:denied?'rejected':'uncertain',error:denied?error.message:'A tentativa ainda não foi confirmada. Nenhuma ação foi repetida.',notFound:error?.status===404})
        return null
      }
    },
    async retryConfirmedAttempt({accountId,api}){
      const attempt=attempts.get(accountId)
      if(attempt?.status!=='uncertain' || !attempt.notFound) return null
      return write(accountId,attempt,api)
    },
    acknowledge(accountId,key){const attempt=attempts.get(accountId);if(attempt?.key===key && ['confirmed','rejected'].includes(attempt.status)){attempts.delete(accountId);for(const listener of listeners) listener()}},
  }
}
