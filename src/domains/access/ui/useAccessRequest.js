import { useCallback, useEffect, useRef, useState } from 'react'

// Context identity comes from the verified runtime. Mask old state in the render
// that changes context, before effects can clear or refresh it.
export function useAccessRequest(owner, onApiError) {
  const current = useRef(owner)
  current.current = owner
  const errorCallback = useRef(onApiError)
  errorCallback.current = onApiError
  const mounted = useRef(true)
  const lock = useRef(null)
  const [state, setState] = useState({ owner })
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const owns = useCallback(() => mounted.current && current.current === owner, [owner])
  const patch = useCallback((value) => {
    if (!owns()) return false
    setState(previous => ({ ...(previous.owner === owner ? previous : {}), ...value, owner }))
    return true
  }, [owner, owns])
  const run = useCallback(async (operation, accept) => {
    if (!owns() || lock.current?.owner === owner) return false
    const operationLock = { owner }
    lock.current = operationLock
    patch({ pending: true, error: '' })
    try {
      const result = await operation()
      if (!owns()) return false
      await accept?.(result)
      return owns() ? result : false
    } catch (error) {
      if (!owns()) return false
      patch({ error: error?.message || 'Não foi possível concluir. Tente novamente.' })
      errorCallback.current?.(error)
      return false
    } finally {
      if (lock.current === operationLock) lock.current = null
      patch({ pending: false })
    }
  }, [owner, owns, patch])
  return { state: state.owner === owner ? state : {}, patch, run, owns }
}
