import { useMemo } from 'react'
import { PolicyEditingProvider } from '../../policy-editing/PolicyEditingProvider.jsx'
import { createSettingsPolicyAdapters } from './policies/registry.js'
import { resolveSettingsPolicyNavigationDraft } from './policies/navigation.js'

export const toPolicyEditingContext = (owner) => owner?.businessId && owner?.settingsContextId
  ? {
      ownerId: owner.businessId,
      generation: owner.generation,
      contextId: owner.settingsContextId,
      capabilities: [...(owner.capabilities || [])],
    }
  : null

const unknownPolicy = (policyId) => Object.assign(new Error(`Política de configurações desconhecida: ${policyId}`), {
  code: 'SETTINGS_POLICY_UNKNOWN',
})

export const createSettingsPolicyTransport = (adapters = createSettingsPolicyAdapters()) => ({
  load: (policyId, scopeId) => {
    const adapter = adapters[policyId]
    if (!adapter) throw unknownPolicy(policyId)
    return adapter.load(scopeId)
  },
  save: (policyId, input, scopeId) => {
    const adapter = adapters[policyId]
    if (!adapter) throw unknownPolicy(policyId)
    return adapter.save(input, scopeId)
  },
  loadReceipt: (policyId, mutationId, scopeId) => {
    const adapter = adapters[policyId]
    if (!adapter) throw unknownPolicy(policyId)
    return adapter.loadReceipt(mutationId, scopeId)
  },
})

export function SettingsPolicyBoundary({
  effectiveConfigOwner,
  storage,
  navigationBridge,
  onFeedback,
  onSessionExpired,
  onPolicyCommitted,
  children,
}) {
  const transport = useMemo(() => createSettingsPolicyTransport(), [])
  const context = toPolicyEditingContext(effectiveConfigOwner)

  return <PolicyEditingProvider
    transport={transport}
    context={context}
    storage={storage}
    navigationBridge={navigationBridge}
    resolveNavigationDraft={resolveSettingsPolicyNavigationDraft}
    onFeedback={onFeedback}
    onSessionExpired={onSessionExpired}
    onPolicyCommitted={onPolicyCommitted}
  >
    {children}
  </PolicyEditingProvider>
}

export default SettingsPolicyBoundary
