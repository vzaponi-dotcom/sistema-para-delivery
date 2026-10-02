import { useContext, useEffect, useState } from 'react'
import { ContextApi } from './ContextApi.js'

export function useContextBlob(path, { urlApi = globalThis.URL } = {}) {
  const client = useContext(ContextApi)
  const [state, setState] = useState(null)
  useEffect(() => {
    if (!client?.contextId || !path) return undefined
    let cancelled = false, ownedUrl
    const controller = new AbortController()
    void client.blob(path, { signal: controller.signal }).then(blob => {
      if (cancelled) return
      ownedUrl = urlApi.createObjectURL(blob)
      setState({ client, path, url: ownedUrl })
    }).catch(() => { if (!cancelled) setState(null) })
    return () => { cancelled = true; controller.abort(); if (ownedUrl) urlApi.revokeObjectURL(ownedUrl) }
  }, [client, path, urlApi])
  if (!client?.contextId) return path
  return state?.client === client && state.path === path ? state.url : null
}
