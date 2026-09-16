import { useEffect, useState } from 'react'
import { getSettings, getSettingsReceipt, putSettings } from '../api/settingsClient.js'
import { createPolicyEditingController, policyResourceKey } from './policy-editing/policyEditingController.js'

const defaultApi = { getSettings, putSettings, getSettingsReceipt }
const toPolicyContext = (context) => context && { ...context, contextId: context.settingsContextId }
const toTransport = (api) => ({
  load: (policyId, scopeId) => api.getSettings(policyId, scopeId),
  save: (policyId, input, scopeId) => api.putSettings(policyId, input, scopeId),
  loadReceipt: (policyId, mutationId, scopeId) => api.getSettingsReceipt(policyId, mutationId, scopeId),
})

export const settingsResourceKey = policyResourceKey

export function createBusinessSettingsController({ api = defaultApi, context, ...options } = {}) {
  const controller = createPolicyEditingController({ ...options, context: toPolicyContext(context), transport: toTransport(api) })
  const configure = controller.configure
  return {
    ...controller,
    configure(next = {}) {
      configure({ ...next, transport: next.api ? toTransport(next.api) : next.transport })
    },
    setContext(nextContext) {
      return controller.setContext(toPolicyContext(nextContext))
    },
  }
}

export function useBusinessSettingsController({ context, storage = globalThis.sessionStorage, api, onFeedback, onSessionExpired, onConflictReview, onPolicyCommitted } = {}) {
  const [resources, setResources] = useState({})
  const [controller] = useState(() => createBusinessSettingsController({ context, storage, api, onFeedback, onSessionExpired, onConflictReview, onPolicyCommitted, onChange: setResources }))
  useEffect(() => { controller.configure({ api, storage, onFeedback, onSessionExpired, onConflictReview, onPolicyCommitted }) }, [api, controller, onConflictReview, onFeedback, onPolicyCommitted, onSessionExpired, storage])
  useEffect(() => { controller.setContext(context) }, [context, controller])
  return {
    resources,
    load: controller.load,
    edit: controller.edit,
    save: controller.save,
    discard: controller.discard,
    reviewConflict: controller.reviewConflict,
    acceptConflictReview: controller.acceptConflictReview,
    reconcile: controller.reconcile,
    reset: controller.reset,
  }
}
