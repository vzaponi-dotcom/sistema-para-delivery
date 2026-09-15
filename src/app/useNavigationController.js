import { useCallback, useRef, useState } from 'react'
import {
  NAVIGATION_DESTINATIONS,
  decideNavigation,
  resolveArea,
  resolveDestination,
} from './navigation.js'

const HOME_AREAS = ['orders', 'finance', 'settings']

function resolveHome(granted, implemented) {
  for (const area of HOME_AREAS) {
    const destination = resolveArea(area, granted, implemented)
    if (destination) return destination
  }

  for (const { id } of NAVIGATION_DESTINATIONS) {
    if (id === 'new-order') continue
    if (resolveDestination(id, granted, implemented).status === 'allowed') return id
  }

  return null
}

export function hasSettingsUnloadRisk(resources) {
  return Object.values(resources || {}).some((resource) => (
    resource?.dirty === true || ['saving', 'unconfirmed'].includes(resource?.status)
  ))
}

const shouldConfirmSettingsExit = (draft, active, destination) => Boolean(
  draft?.dirty
  && !['saving', 'unconfirmed'].includes(draft.status)
  && draft.destinations instanceof Set
  && draft.destinations.has(active)
  && !draft.destinations.has(destination),
)

export function useNavigationController({
  granted,
  implemented,
  checkoutPending,
  dirtyOrder,
  onDiscardOrder,
  getSettingsDraft,
  onDiscardSettings,
  onFeedback,
}) {
  const [activeTab, setActiveTab] = useState(() => resolveHome(granted, implemented))
  const [moreOpen, setMoreOpen] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState(null)
  const pendingNavigationRef = useRef(null)
  const pendingDestination = pendingNavigation?.destination || null
  const resolvedActiveTab = activeTab && resolveDestination(activeTab, granted, implemented).status === 'allowed'
    ? activeTab
    : resolveHome(granted, implemented)

  const resolveTarget = useCallback((target) => {
    if (target && typeof target === 'object') {
      const id = resolveArea(target.area, granted, implemented)
      return id ? { status: 'allowed', id } : { status: 'denied' }
    }
    return resolveDestination(target, granted, implemented)
  }, [granted, implemented])

  const reject = useCallback((status) => {
    const messages = {
      unknown: 'Destino desconhecido.',
      denied: 'Você não tem acesso a este destino.',
      unavailable: 'Este destino ainda não está disponível.',
      blocked: 'Aguarde o envio do pedido antes de navegar.',
    }
    onFeedback?.(messages[status] || messages.denied)
    return false
  }, [onFeedback])

  const requestNavigation = useCallback((target) => {
    if (pendingNavigationRef.current) return false
    const resolution = resolveTarget(target)
    const allowed = resolution.status === 'allowed'
    const leavingOrder = resolvedActiveTab === 'new-order' && resolution.id !== 'new-order'
    const decision = decideNavigation({
      allowed,
      checkoutPending,
      dirtyOrder,
      leavingOrder,
    })

    if (decision === 'reject') return reject(resolution.status)
    if (decision === 'blocked') return reject('blocked')

    setMoreOpen(false)
    if (decision === 'confirm') {
      const pending = { kind: 'order', destination: resolution.id }
      pendingNavigationRef.current = pending
      setPendingNavigation(pending)
      return false
    }

    const settingsDraft = getSettingsDraft?.(resolvedActiveTab)
    if (shouldConfirmSettingsExit(settingsDraft, resolvedActiveTab, resolution.id)) {
      const pending = { kind: 'settings', destination: resolution.id, settingsDraft }
      pendingNavigationRef.current = pending
      setPendingNavigation(pending)
      return false
    }

    if (leavingOrder) onDiscardOrder?.()
    setActiveTab(resolution.id)
    return true
  }, [checkoutPending, dirtyOrder, getSettingsDraft, onDiscardOrder, reject, resolveTarget, resolvedActiveTab])

  const completeNavigation = useCallback((id) => {
    const resolution = resolveDestination(id, granted, implemented)
    if (resolution.status !== 'allowed') return reject(resolution.status)
    pendingNavigationRef.current = null
    setPendingNavigation(null)
    setMoreOpen(false)
    setActiveTab(resolution.id)
    return true
  }, [granted, implemented, reject])

  const confirmDiscard = useCallback(() => {
    const pending = pendingNavigationRef.current
    if (!pending) return false
    pendingNavigationRef.current = null
    setPendingNavigation(null)
    const resolution = resolveDestination(pending.destination, granted, implemented)
    if (resolution.status !== 'allowed') return reject(resolution.status)
    if (pending.kind === 'order') {
      if (checkoutPending) return reject('blocked')
      onDiscardOrder?.()
    } else {
      const currentDraft = getSettingsDraft?.(resolvedActiveTab)
      if (shouldConfirmSettingsExit(currentDraft, resolvedActiveTab, resolution.id)) {
        const discarded = onDiscardSettings?.(currentDraft.resourceKey, currentDraft)
        if (discarded === false) return false
      }
    }
    setActiveTab(resolution.id)
    return true
  }, [checkoutPending, getSettingsDraft, granted, implemented, onDiscardOrder, onDiscardSettings, reject, resolvedActiveTab])

  const cancelDiscard = useCallback(() => {
    pendingNavigationRef.current = null
    setPendingNavigation(null)
  }, [])
  const discardSettingsAndNavigate = useCallback((target) => {
    if (pendingNavigationRef.current) return false
    const resolution = resolveTarget(target)
    if (resolution.status !== 'allowed') return reject(resolution.status)
    const currentDraft = getSettingsDraft?.(resolvedActiveTab)
    if (currentDraft) {
      const discarded = onDiscardSettings?.(currentDraft.resourceKey, currentDraft)
      if (discarded === false) return false
    }
    setMoreOpen(false)
    setActiveTab(resolution.id)
    return true
  }, [getSettingsDraft, onDiscardSettings, reject, resolveTarget, resolvedActiveTab])
  const openMore = useCallback(() => setMoreOpen(true), [])
  const closeMore = useCallback(() => setMoreOpen(false), [])
  const resetNavigation = useCallback(() => {
    setMoreOpen(false)
    pendingNavigationRef.current = null
    setPendingNavigation(null)
    setActiveTab(resolveHome(granted, implemented))
  }, [granted, implemented])

  return {
    activeTab: resolvedActiveTab,
    moreOpen,
    pendingDestination,
    pendingDiscardKind: pendingNavigation?.kind || null,
    requestNavigation,
    openMore,
    closeMore,
    confirmDiscard,
    cancelDiscard,
    discardSettingsAndNavigate,
    resetNavigation,
    completeNavigation,
  }
}
