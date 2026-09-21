import { useCallback, useEffect, useState } from 'react'
import { getEffectiveConfig } from '../infrastructure/api/effectiveConfigApi.js'

const capabilityKey = (capabilities = []) => [...new Set(capabilities)].sort().join('\u001f')
const ownerIdentity = (value) => {
  const owner = value || {}
  return [
  owner.businessId || '',
  Number(owner.generation) || 0,
  owner.settingsContextId || '',
  capabilityKey(owner.capabilities),
].join('\u001e')
}

export function shouldAcceptEffectiveReply(currentOwner, incomingOwner) {
  return ownerIdentity(currentOwner) === ownerIdentity(incomingOwner)
    && Number.isSafeInteger(incomingOwner?.requestId)
    && incomingOwner.requestId >= (Number(currentOwner?.requestId) || 0)
}

const validConfig = (value) => Boolean(value && typeof value.version === 'string' && value.version && value.revisions && typeof value.revisions === 'object')
const revisionsDoNotRegress = (current, incoming) => Object.entries(current?.revisions || {}).every(([resource, revision]) => (
  Number.isSafeInteger(revision)
  && Number.isSafeInteger(incoming?.revisions?.[resource])
  && incoming.revisions[resource] >= revision
))

export function createEffectiveBusinessConfigCache({ load = getEffectiveConfig } = {}) {
  let state = { config: null, status: 'idle', error: null }
  let activeOwner = null
  let latestRequestId = 0
  let loadConfig = load
  const listeners = new Set()
  const publish = (next) => {
    state = next
    listeners.forEach((listener) => listener(state))
  }
  const currentOwner = () => activeOwner && { ...activeOwner, requestId: latestRequestId }
  const api = {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    setLoad(nextLoad) { loadConfig = nextLoad },
    setOwner(nextOwner) {
      const normalized = nextOwner?.businessId && nextOwner?.settingsContextId
        ? { ...nextOwner, capabilities: [...(nextOwner.capabilities || [])], requestId: 0 }
        : null
      if (ownerIdentity(normalized) === ownerIdentity(activeOwner)) return false
      activeOwner = normalized
      latestRequestId = 0
      publish({ config: null, status: normalized ? 'loading' : 'idle', error: null })
      return true
    },
    accept(incomingConfig, incomingOwner = activeOwner) {
      const ownerWithRequest = { ...incomingOwner, requestId: incomingOwner?.requestId ?? latestRequestId }
      if (!activeOwner || !shouldAcceptEffectiveReply(currentOwner(), ownerWithRequest) || !validConfig(incomingConfig)) return false
      if (state.config && !revisionsDoNotRegress(state.config, incomingConfig)) return false
      publish({ config: incomingConfig, status: 'ready', error: null })
      return true
    },
    async refresh() {
      if (!activeOwner) return false
      const requestId = ++latestRequestId
      const requestOwner = { ...activeOwner, requestId }
      publish({ ...state, status: state.config ? 'ready' : 'loading', error: null })
      try {
        const response = await loadConfig(state.config?.version)
        if (!shouldAcceptEffectiveReply(currentOwner(), requestOwner)) return false
        if (response?.effectiveConfigVersion === state.config?.version) {
          publish({ ...state, status: 'ready', error: null })
          return true
        }
        if (!api.accept(response, requestOwner)) throw Object.assign(new Error('Resposta de configuração inválida.'), { code: 'EFFECTIVE_CONFIG_INVALID' })
        return true
      } catch (error) {
        if (!shouldAcceptEffectiveReply(currentOwner(), requestOwner)) return false
        publish({ ...state, status: 'error', error })
        return false
      }
    },
    reset() {
      activeOwner = null
      latestRequestId += 1
      publish({ config: null, status: 'idle', error: null })
    },
  }
  return api
}

export function useEffectiveBusinessConfig({ owner, bootstrapConfig, load = getEffectiveConfig } = {}) {
  const [cache] = useState(() => createEffectiveBusinessConfigCache({ load }))
  const [state, setState] = useState(cache.getState)
  useEffect(() => cache.subscribe(setState), [cache])
  useEffect(() => { cache.setLoad(load) }, [cache, load])
  useEffect(() => {
    cache.setOwner(owner)
    if (bootstrapConfig) cache.accept(bootstrapConfig, owner)
  }, [bootstrapConfig, cache, owner])
  const accept = useCallback((value, replyOwner) => cache.accept(value, replyOwner), [cache])
  const refresh = useCallback(() => cache.refresh(), [cache])
  const reset = useCallback(() => cache.reset(), [cache])
  return { ...state, accept, refresh, reset }
}
