import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPolicyEditingController, policyResourceKey } from './policyEditingController.js'
import { PolicyEditingContext } from './policyEditingContext.js'

const hasUnloadRisk = (resources) => Object.values(resources).some((resource) => (
  resource?.dirty === true || ['saving', 'unconfirmed'].includes(resource?.status)
))

export function PolicyEditingProvider({
  transport,
  context,
  storage = globalThis.sessionStorage,
  navigationBridge,
  resolveNavigationDraft = () => null,
  onFeedback,
  onSessionExpired,
  onPolicyCommitted,
  children,
}) {
  const [resources, setResources] = useState({})
  const [activeConflict, setActiveConflict] = useState(null)
  const [controller] = useState(() => createPolicyEditingController({
      transport,
      context,
      storage,
      onChange: setResources,
      onFeedback,
      onSessionExpired,
      onConflictReview: setActiveConflict,
      onPolicyCommitted,
    }))

  useEffect(() => {
    controller.configure({ transport, storage, onFeedback, onSessionExpired, onPolicyCommitted })
  }, [controller, onFeedback, onPolicyCommitted, onSessionExpired, storage, transport])

  useEffect(() => {
    if (controller.setContext(context)) setActiveConflict(null)
  }, [context, controller])

  const reviewConflict = useCallback(async (resource, scopeId) => {
    const review = await controller.reviewConflict(resource, scopeId)
    if (review) setActiveConflict(review)
    return review
  }, [controller])
  const acceptActiveConflict = useCallback((candidate) => {
    if (!activeConflict) return false
    const accepted = controller.acceptConflictReview(activeConflict, candidate)
    if (accepted) setActiveConflict(null)
    return accepted
  }, [activeConflict, controller])
  const dismissActiveConflict = useCallback(() => setActiveConflict(null), [])
  const discard = useCallback((resource, scopeId) => {
    const discarded = controller.discard(resource, scopeId)
    if (discarded) {
      const resourceKey = policyResourceKey(resource, scopeId)
      setActiveConflict((conflict) => conflict?.resourceKey === resourceKey ? null : conflict)
    }
    return discarded
  }, [controller])
  const reset = useCallback(() => {
    controller.reset()
    setActiveConflict(null)
  }, [controller])
  const getNavigationDraft = useCallback((destination) => resolveNavigationDraft(resources, destination) ?? null, [resolveNavigationDraft, resources])
  const discardNavigationDraft = useCallback((resourceKey) => discard(resourceKey), [discard])
  const unloadRisk = hasUnloadRisk(resources)
  const getUnloadRisk = useCallback(() => unloadRisk, [unloadRisk])

  useEffect(() => {
    if (!unloadRisk || typeof window === 'undefined') return undefined
    const warnBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [unloadRisk])

  useEffect(() => {
    if (!navigationBridge) return undefined
    const contract = { getNavigationDraft, discardNavigationDraft, hasUnloadRisk: getUnloadRisk }
    navigationBridge.connect(contract)
    return () => navigationBridge.disconnect(contract)
  }, [discardNavigationDraft, getNavigationDraft, getUnloadRisk, navigationBridge])

  const value = useMemo(() => ({
    resources,
    load: controller.load,
    edit: controller.edit,
    save: controller.save,
    discard,
    reconcile: controller.reconcile,
    reviewConflict,
    activeConflict,
    acceptActiveConflict,
    dismissActiveConflict,
    reset,
  }), [acceptActiveConflict, activeConflict, controller, discard, dismissActiveConflict, reset, resources, reviewConflict])

  return <PolicyEditingContext.Provider value={value}>{children}</PolicyEditingContext.Provider>
}
