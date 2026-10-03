import { useCallback,useEffect,useMemo,useRef,useState } from 'react'

const invalid='Link inválido ou expirado. Solicite um novo link.'
const missing='Abra novamente o link recebido por e-mail. Ao atualizar esta página, o link precisa ser reaberto.'
export function useEmailChallenge({expectedPurpose,api,location=globalThis.window?.location,history=globalThis.window?.history}) {
  const owner=useMemo(()=>({service:api,purpose:expectedPurpose,path:location?.pathname,key:location?.key}),[api,expectedPurpose,location])
  const current=useRef(owner);current.current=owner
  const capture=useRef(null),mounted=useRef(false),lock=useRef(null)
  const [state,setState]=useState({owner,pending:true,error:'',ready:false})
  const owns=useCallback(()=>mounted.current&&current.current===owner,[owner])
  const patch=useCallback(value=>{if(owns())setState(previous=>({...previous,...value,owner}))},[owner,owns])
  useEffect(()=>{
    mounted.current=true
    let active=true
    if(capture.current?.owner!==owner){
      const params=new URLSearchParams((location?.hash||'').replace(/^#/,''))
      const token=params.get('token')
      const captured={owner,token:'',ready:false}
      capture.current=captured
      try {
        // Clear the fragment before any network request. Preserve router state.
        if(location?.hash){
          if(!history?.replaceState)throw new Error(invalid)
          const search=new URLSearchParams(location.search||'');search.delete('token')
          history.replaceState(history.state??null,'',`${location.pathname}${search.size?`?${search}`:''}`)
        }
        if(!token)throw new Error(missing)
        if(params.size!==1||! /^[A-Za-z0-9_-]{43}$/.test(token))throw new Error(invalid)
        captured.token=token
        // A reused promise survives StrictMode's effect replay without another POST.
        captured.inspection=Promise.resolve(api.inspectChallenge({token}))
      } catch(error){captured.error=error.message}
    }
    const captured=capture.current
    if(captured.error)patch({pending:false,ready:false,error:captured.error})
    else captured.inspection.then(result=>{
      if(!active||!owns()||capture.current!==captured)return
      if(result?.purpose!==expectedPurpose||!Number.isFinite(Date.parse(result.expiresAt))){captured.token='';patch({pending:false,ready:false,error:invalid});return}
      captured.ready=true;patch({pending:false,ready:true,error:'',expiresAt:result.expiresAt,completed:false})
    },error=>{
      if(!active||!owns()||capture.current!==captured)return
      captured.token='';patch({pending:false,ready:false,error:error?.message||invalid})
    })
    return ()=>{active=false;mounted.current=false}
  },[owner,api,expectedPurpose,history,location,owns,patch])

  const complete=useCallback(async password=>{
    const captured=capture.current
    if(!owns()||captured?.owner!==owner||!captured.ready||!captured.token||lock.current?.owner===owner)return false
    const operation={owner};lock.current=operation
    patch({pending:true,error:''})
    try {
      const result=await api.completeChallenge({token:captured.token,password})
      if(!owns()||capture.current!==captured)return false
      if(result?.completed!==true||result.purpose!==expectedPurpose)throw new Error(invalid)
      captured.token='';captured.ready=false
      patch({completed:true,ready:false,pending:false,error:''})
      return result
    } catch(error){if(owns()&&capture.current===captured)patch({pending:false,error:error?.message||invalid});return false}
    finally {if(lock.current===operation)lock.current=null}
  },[owner,api,expectedPurpose,owns,patch])
  return {...(state.owner===owner?state:{pending:true,ready:false,error:'',completed:false}),complete}
}
