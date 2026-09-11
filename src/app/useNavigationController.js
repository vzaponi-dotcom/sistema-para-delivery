import { useCallback, useState } from 'react'
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

export function useNavigationController({
  granted,
  implemented,
  checkoutPending,
  dirtyOrder,
  onDiscardOrder,
  onFeedback,
}) {
  const [activeTab, setActiveTab] = useState(() => resolveHome(granted, implemented))
  const [moreOpen, setMoreOpen] = useState(false)
  const [pendingDestination, setPendingDestination] = useState(null)
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
      setPendingDestination(resolution.id)
      return false
    }

    if (leavingOrder) onDiscardOrder?.()
    setActiveTab(resolution.id)
    return true
  }, [checkoutPending, dirtyOrder, onDiscardOrder, reject, resolveTarget, resolvedActiveTab])

  const completeNavigation = useCallback((id) => {
    const resolution = resolveDestination(id, granted, implemented)
    if (resolution.status !== 'allowed') return reject(resolution.status)
    setPendingDestination(null)
    setMoreOpen(false)
    setActiveTab(resolution.id)
    return true
  }, [granted, implemented, reject])

  const confirmDiscard = useCallback(() => {
    if (!pendingDestination) return false
    const resolution = resolveDestination(pendingDestination, granted, implemented)
    setPendingDestination(null)
    if (resolution.status !== 'allowed') return reject(resolution.status)
    if (checkoutPending) return reject('blocked')
    onDiscardOrder?.()
    setActiveTab(resolution.id)
    return true
  }, [checkoutPending, granted, implemented, onDiscardOrder, pendingDestination, reject])

  const cancelDiscard = useCallback(() => setPendingDestination(null), [])
  const openMore = useCallback(() => setMoreOpen(true), [])
  const closeMore = useCallback(() => setMoreOpen(false), [])
  const resetNavigation = useCallback(() => {
    setMoreOpen(false)
    setPendingDestination(null)
    setActiveTab(resolveHome(granted, implemented))
  }, [granted, implemented])

  return {
    activeTab: resolvedActiveTab,
    moreOpen,
    pendingDestination,
    requestNavigation,
    openMore,
    closeMore,
    confirmDiscard,
    cancelDiscard,
    resetNavigation,
    completeNavigation,
  }
}
