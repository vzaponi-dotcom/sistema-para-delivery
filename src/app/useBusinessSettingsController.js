import { useEffect, useState } from 'react'
import { getSettings, getSettingsReceipt, putSettings } from '../api/settingsClient.js'
import { clearPending, clearPendingContext, readPending, SETTINGS_PENDING_TTL_MS, writePending } from './settingsPendingStorage.js'
import { createSettingsState, settingsReducer } from './settingsState.js'
import { buildSettingsConflict } from './settingsConflict.js'

export const settingsResourceKey = (resource, scopeId) => scopeId ? `${resource}:${scopeId}` : resource
const contextSignature = (context) => context ? [
  context.businessId,
  context.generation,
  context.settingsContextId,
  [...new Set(context.capabilities || [])].sort().join('\u001f'),
].join('\u001e') : ''
const isUnknownResult = (error) => !Number.isInteger(error?.status) || error.status === 408 || error.status >= 500
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  return value
}
const hashPayload = async (value) => {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createBusinessSettingsController({
  api = { getSettings, putSettings, getSettingsReceipt },
  context = null,
  storage = globalThis.sessionStorage,
  now = () => new Date(),
  createMutationId = () => crypto.randomUUID(),
  hash = hashPayload,
  onChange = () => {},
  onFeedback = () => {},
  onSessionExpired = () => {},
  onConflictReview = () => {},
} = {}) {
  let activeContext = context
  let generation = 0
  let resources = {}
  let operationSequence = 0
  const readOwners = new Map()
  const writeOwners = new Map()
  const savePreparations = new Map()
  const conflictReviews = new Map()
  const publish = (key, event) => {
    resources = { ...resources, [key]: settingsReducer(resources[key] || createSettingsState(), event) }
    onChange(resources)
    return resources[key]
  }
  const begin = (owners, key) => {
    const owner = { generation, operationId: ++operationSequence }
    owners.set(key, owner)
    return owner
  }
  const owns = (owners, key, owner) => generation === owner.generation && owners.get(key)?.operationId === owner.operationId
  const contextId = () => activeContext?.settingsContextId || ''
  const validContext = () => Boolean(activeContext?.businessId && contextId())
  const controller = {
    getResources: () => resources,
    configure(next = {}) {
      if (next.api) api = next.api
      if (Object.hasOwn(next, 'storage')) storage = next.storage
      if (next.onFeedback) onFeedback = next.onFeedback
      if (next.onSessionExpired) onSessionExpired = next.onSessionExpired
      if (next.onConflictReview) onConflictReview = next.onConflictReview
    },
    setContext(nextContext) {
      if (contextSignature(nextContext) === contextSignature(activeContext)) return false
      if (activeContext?.settingsContextId) clearPendingContext(storage, activeContext.settingsContextId)
      activeContext = nextContext
      generation += 1
      readOwners.clear()
      writeOwners.clear()
      savePreparations.clear()
      conflictReviews.clear()
      resources = {}
      onChange(resources)
      return true
    },
    async load(resource, scopeId) {
      if (!validContext()) return false
      const key = settingsResourceKey(resource, scopeId)
      const owner = begin(readOwners, key)
      const initialLoad = !resources[key]?.confirmed && !resources[key]?.submitted
      if (initialLoad) publish(key, { type: 'loading' })
      try {
        const value = await api.getSettings(resource, scopeId)
        if (!owns(readOwners, key, owner)) return false
        publish(key, { type: 'loaded', value })
        const pointer = resources[key]?.submitted ? null : readPending(storage, contextId(), key, now())
        if (pointer) publish(key, { type: 'pendingRecovered', pointer })
        return true
      } catch (error) {
        if (!owns(readOwners, key, owner)) return false
        if (error?.status === 401) { onSessionExpired(error); controller.reset(); return false }
        if (initialLoad) publish(key, { type: 'loadFailed', error })
        return false
      }
    },
    edit(resource, data, scopeId) {
      const key = settingsResourceKey(resource, scopeId)
      if (!resources[key]?.confirmed) return false
      conflictReviews.delete(key)
      publish(key, { type: 'edited', data })
      return true
    },
    discard(resource, scopeId) {
      const key = settingsResourceKey(resource, scopeId)
      if (!resources[key] || ['saving', 'unconfirmed'].includes(resources[key].status)) return false
      conflictReviews.delete(key)
      publish(key, { type: 'discarded' })
      return true
    },
    async reviewConflict(resource, scopeId) {
      if (!validContext()) return null
      const key = settingsResourceKey(resource, scopeId)
      const original = resources[key]
      if (original?.status !== 'conflict' || !original.base || !original.draft) return null
      const owner = begin(readOwners, key)
      try {
        const current = await api.getSettings(resource, scopeId)
        if (!owns(readOwners, key, owner) || resources[key]?.status !== 'conflict') return null
        publish(key, { type: 'loaded', value: current })
        const state = resources[key]
        const review = {
          ...buildSettingsConflict({ base: state.base, draft: state.draft, current: state.confirmed }),
          reviewId: `${generation}:${owner.operationId}`,
          resource,
          scopeId: scopeId || null,
          resourceKey: key,
          generation,
        }
        conflictReviews.set(key, review)
        return review
      } catch (error) {
        if (!owns(readOwners, key, owner)) return null
        if (error?.status === 401) { onSessionExpired(error); controller.reset(); return null }
        onFeedback({ status: 'conflict-review-unavailable', resource, scopeId, message: error?.message || 'Não foi possível carregar o estado atual para revisão.' })
        return null
      }
    },
    acceptConflictReview(review, candidate) {
      if (!validContext() || !review?.resourceKey) return false
      const activeReview = conflictReviews.get(review.resourceKey)
      const state = resources[review.resourceKey]
      if (!activeReview || activeReview.reviewId !== review.reviewId || review.generation !== generation
        || state?.status !== 'conflict' || state.confirmed?.revision !== review.currentRevision) return false
      conflictReviews.delete(review.resourceKey)
      publish(review.resourceKey, { type: 'conflictReviewAccepted' })
      return controller.edit(review.resource, candidate, review.scopeId || undefined)
    },
    async save(resource, scopeId) {
      if (!validContext()) return false
      const key = settingsResourceKey(resource, scopeId)
      const current = resources[key]
      if (!current?.dirty || savePreparations.has(key) || ['saving', 'unconfirmed', 'conflict'].includes(current.status)) return false
      const reservation = {}
      savePreparations.set(key, reservation)
      const saveGeneration = generation
      const saveContext = contextSignature(activeContext)
      let mutationId
      let startedAt
      let input
      let payloadHash
      try {
        mutationId = createMutationId()
        startedAt = now().toISOString()
        input = { expectedRevision: current.base.revision, mutationId, data: structuredClone(current.draft) }
        payloadHash = await hash({ resource, scopeId: scopeId || null, ...input })
      } catch (error) {
        if (savePreparations.get(key) === reservation) savePreparations.delete(key)
        throw error
      }
      if (savePreparations.get(key) !== reservation || generation !== saveGeneration || contextSignature(activeContext) !== saveContext || !validContext()) return false
      const owner = begin(writeOwners, key)
      publish(key, { type: 'saveStarted', mutationId, payloadHash, startedAt, expectedRevision: input.expectedRevision, data: input.data })
      savePreparations.delete(key)
      const persisted = writePending(storage, contextId(), key, { resource, scopeId, mutationId, payloadHash, startedAt, contextId: contextId() })
      if (!persisted.ok) onFeedback({ code: 'SETTINGS_PENDING_STORAGE_UNAVAILABLE', message: 'A recuperação após recarregar não está disponível neste navegador.', cause: persisted.error })
      try {
        const result = await api.putSettings(resource, input, scopeId)
        if (!owns(writeOwners, key, owner)) return false
        clearPending(storage, contextId(), key)
        publish(key, { type: 'saveConfirmed', value: result.resource })
        onFeedback({ status: 'confirmed', resource, scopeId, receipt: result.receipt })
        return true
      } catch (error) {
        if (!owns(writeOwners, key, owner)) return false
        if (error?.status === 401) { onSessionExpired(error); controller.reset(); return false }
        if (error?.status === 409) {
          clearPending(storage, contextId(), key)
          publish(key, { type: 'saveConflict', error })
          const review = await controller.reviewConflict(resource, scopeId)
          if (review) onConflictReview(review)
        } else if (isUnknownResult(error)) {
          publish(key, { type: 'saveUnconfirmed', error })
          onFeedback({ status: 'unconfirmed', resource, scopeId, message: 'Resultado da gravação não confirmado.' })
        } else {
          clearPending(storage, contextId(), key)
          publish(key, { type: 'saveFailed', error })
        }
        return false
      }
    },
    async reconcile(resource, scopeId) {
      if (!validContext()) return false
      const key = settingsResourceKey(resource, scopeId)
      const submitted = resources[key]?.submitted
      if (!submitted || resources[key].status !== 'unconfirmed') return false
      const owner = begin(writeOwners, key)
      const startedAt = Date.parse(submitted.startedAt)
      const expired = submitted.expired || (Number.isFinite(startedAt) && now().getTime() - startedAt >= SETTINGS_PENDING_TTL_MS)
      if (expired) {
        try {
          const current = await api.getSettings(resource, scopeId)
          if (!owns(writeOwners, key, owner)) return false
          const confirmedRevision = resources[key]?.confirmed?.revision
          if (Number.isSafeInteger(confirmedRevision) && (!Number.isSafeInteger(current?.revision) || current.revision < confirmedRevision)) {
            publish(key, { type: 'saveUnconfirmed' })
            return false
          }
          clearPending(storage, contextId(), key)
          publish(key, { type: 'expiredRefreshed', value: current })
          onFeedback({ status: 'expired', resource, scopeId, message: 'A gravação pendente expirou. Revise o estado atual antes de salvar novamente.' })
        } catch (error) {
          if (!owns(writeOwners, key, owner)) return false
          if (error?.status === 401) { onSessionExpired(error); controller.reset(); return false }
          publish(key, { type: 'saveUnconfirmed', error })
        }
        return false
      }
      try {
        const result = await api.getSettingsReceipt(resource, submitted.mutationId, scopeId)
        if (!owns(writeOwners, key, owner)) return false
        if (result?.status !== 'confirmed') {
          publish(key, { type: 'saveUnconfirmed' })
          return false
        }
        const current = await api.getSettings(resource, scopeId)
        if (!owns(writeOwners, key, owner)) return false
        const confirmedRevision = resources[key]?.confirmed?.revision
        if (!Number.isSafeInteger(current?.revision) || current.revision < result.receipt.committedRevision
          || (Number.isSafeInteger(confirmedRevision) && current.revision < confirmedRevision)) {
          publish(key, { type: 'saveUnconfirmed' })
          return false
        }
        clearPending(storage, contextId(), key)
        publish(key, { type: 'saveConfirmed', value: current })
        onFeedback({ status: 'confirmed', resource, scopeId, receipt: result.receipt })
        return true
      } catch (error) {
        if (!owns(writeOwners, key, owner)) return false
        if (error?.status === 401) { onSessionExpired(error); controller.reset(); return false }
        publish(key, { type: 'saveUnconfirmed', error })
        return false
      }
    },
    reset() {
      if (activeContext?.settingsContextId) clearPendingContext(storage, activeContext.settingsContextId)
      generation += 1
      readOwners.clear()
      writeOwners.clear()
      savePreparations.clear()
      conflictReviews.clear()
      resources = {}
      activeContext = null
      onChange(resources)
    },
  }
  return controller
}

export function useBusinessSettingsController({ context, storage = globalThis.sessionStorage, api, onFeedback, onSessionExpired, onConflictReview } = {}) {
  const [resources, setResources] = useState({})
  const [controller] = useState(() => createBusinessSettingsController({ context, storage, api, onFeedback, onSessionExpired, onConflictReview, onChange: setResources }))
  useEffect(() => { controller.configure({ api, storage, onFeedback, onSessionExpired, onConflictReview }) }, [api, controller, onConflictReview, onFeedback, onSessionExpired, storage])
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
