import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router'
import {
  decideNavigation,
  resolveArea,
  resolveDestination,
  resolveHome,
} from './resolution.js'
import { shouldConfirmDraftExit } from './draftExitGuard.js'
import { destinationForPath, pathForDestination } from './routes.js'
import { useMatchedDestination } from './routeMatch.js'

export function useNavigationController({
  granted,
  implemented,
  checkoutPending,
  dirtyOrder,
  onDiscardOrder,
  getNavigationDraft,
  discardNavigationDraft,
  onFeedback,
}) {
  const resolveNavigationDraft = getNavigationDraft
  const discardDraft = discardNavigationDraft
  const matchedDestination = useMatchedDestination()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState(null)
  const pendingNavigationRef = useRef(null)
  const approvedPathRef = useRef(null)
  const blockerResettingRef = useRef(false)
  const pendingDestination = pendingNavigation?.destination || null
  const resolvedActiveTab = matchedDestination
    && resolveDestination(matchedDestination, granted, implemented).status === 'allowed'
    ? matchedDestination
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

  const shouldBlockRouterNavigation = useCallback(({ currentLocation, nextLocation }) => {
    if (currentLocation.pathname === nextLocation.pathname) return false
    if (approvedPathRef.current === nextLocation.pathname) return false
    if (pendingNavigationRef.current) return true

    const currentDestination = destinationForPath(currentLocation.pathname)
    if (!currentDestination) return false
    if (resolveDestination(currentDestination, granted, implemented).status !== 'allowed') return false

    const nextDestination = destinationForPath(nextLocation.pathname)
    if (!nextDestination) return true

    const nextResolution = resolveDestination(nextDestination, granted, implemented)
    if (nextResolution.status !== 'allowed') return true

    const leavingOrder = currentDestination === 'new-order' && nextDestination !== 'new-order'
    if (leavingOrder && (checkoutPending || dirtyOrder)) return true

    const draft = resolveNavigationDraft?.(currentDestination)
    return shouldConfirmDraftExit(draft, currentDestination, nextDestination)
  }, [checkoutPending, dirtyOrder, granted, implemented, resolveNavigationDraft])

  const blocker = useBlocker(shouldBlockRouterNavigation)

  const resetBlockedNavigation = useCallback(() => {
    if (blocker.state !== 'blocked') return
    blockerResettingRef.current = true
    blocker.reset()
  }, [blocker])

  const navigateApprovedPath = useCallback((path, options) => {
    approvedPathRef.current = path
    const result = navigate(path, options)
    Promise.resolve(result).finally(() => {
      if (approvedPathRef.current === path) approvedPathRef.current = null
    })
    return true
  }, [navigate])

  const navigateToDestination = useCallback((id, options) => {
    const path = pathForDestination(id)
    if (!path) return reject('unknown')
    return navigateApprovedPath(path, options)
  }, [navigateApprovedPath, reject])

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      blockerResettingRef.current = false
      return
    }
    if (blockerResettingRef.current) return

    const pending = pendingNavigationRef.current
    if (pending) {
      if (pending.source !== 'blocker') blocker.reset()
      return
    }

    const currentDestination = matchedDestination
    const nextDestination = destinationForPath(blocker.location.pathname)
    if (!nextDestination) {
      resetBlockedNavigation()
      reject('unknown')
      return
    }

    const resolution = resolveDestination(nextDestination, granted, implemented)
    if (resolution.status !== 'allowed') {
      resetBlockedNavigation()
      reject(resolution.status)
      return
    }

    const leavingOrder = currentDestination === 'new-order' && nextDestination !== 'new-order'
    if (leavingOrder && checkoutPending) {
      resetBlockedNavigation()
      reject('blocked')
      return
    }

    setMoreOpen(false)
    if (leavingOrder && dirtyOrder) {
      const next = { kind: 'order', destination: nextDestination, source: 'blocker' }
      pendingNavigationRef.current = next
      setPendingNavigation(next)
      return
    }

    const draft = resolveNavigationDraft?.(currentDestination)
    if (shouldConfirmDraftExit(draft, currentDestination, nextDestination)) {
      const next = { kind: 'policy', destination: nextDestination, draft, source: 'blocker' }
      pendingNavigationRef.current = next
      setPendingNavigation(next)
      return
    }

    blocker.proceed()
  }, [
    blocker,
    checkoutPending,
    dirtyOrder,
    granted,
    implemented,
    matchedDestination,
    reject,
    resetBlockedNavigation,
    resolveNavigationDraft,
  ])

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
      const pending = { kind: 'order', destination: resolution.id, source: 'request' }
      pendingNavigationRef.current = pending
      setPendingNavigation(pending)
      return false
    }

    const draft = resolveNavigationDraft?.(resolvedActiveTab)
    if (shouldConfirmDraftExit(draft, resolvedActiveTab, resolution.id)) {
      const pending = { kind: 'policy', destination: resolution.id, draft, source: 'request' }
      pendingNavigationRef.current = pending
      setPendingNavigation(pending)
      return false
    }

    if (leavingOrder) onDiscardOrder?.()
    if (resolution.id === resolvedActiveTab) return true
    return navigateToDestination(resolution.id)
  }, [checkoutPending, dirtyOrder, navigateToDestination, onDiscardOrder, reject, resolveNavigationDraft, resolveTarget, resolvedActiveTab])

  const completeNavigation = useCallback((id) => {
    const resolution = resolveDestination(id, granted, implemented)
    if (resolution.status !== 'allowed') return reject(resolution.status)
    pendingNavigationRef.current = null
    setPendingNavigation(null)
    setMoreOpen(false)
    if (resolution.id === resolvedActiveTab) return true
    return navigateToDestination(resolution.id)
  }, [granted, implemented, navigateToDestination, reject, resolvedActiveTab])

  const confirmDiscard = useCallback(() => {
    const pending = pendingNavigationRef.current
    if (!pending) return false

    const resolution = resolveDestination(pending.destination, granted, implemented)
    if (resolution.status !== 'allowed') {
      if (pending.source === 'blocker') resetBlockedNavigation()
      pendingNavigationRef.current = null
      setPendingNavigation(null)
      return reject(resolution.status)
    }

    if (pending.kind === 'order') {
      if (checkoutPending) {
        if (pending.source === 'blocker') resetBlockedNavigation()
        pendingNavigationRef.current = null
        setPendingNavigation(null)
        return reject('blocked')
      }
      onDiscardOrder?.()
    } else {
      const currentDraft = resolveNavigationDraft?.(resolvedActiveTab)
      if (shouldConfirmDraftExit(currentDraft, resolvedActiveTab, resolution.id)) {
        const discarded = discardDraft?.(currentDraft.resourceKey, currentDraft)
        if (discarded === false) return false
      }
    }

    pendingNavigationRef.current = null
    setPendingNavigation(null)

    if (pending.source === 'blocker') {
      if (blocker.state !== 'blocked') return false
      blocker.proceed()
      return true
    }

    return navigateToDestination(resolution.id)
  }, [
    blocker,
    checkoutPending,
    discardDraft,
    granted,
    implemented,
    navigateToDestination,
    onDiscardOrder,
    reject,
    resetBlockedNavigation,
    resolveNavigationDraft,
    resolvedActiveTab,
  ])

  const cancelDiscard = useCallback(() => {
    const pending = pendingNavigationRef.current
    pendingNavigationRef.current = null
    setPendingNavigation(null)
    if (pending?.source === 'blocker') resetBlockedNavigation()
  }, [resetBlockedNavigation])

  const openMore = useCallback(() => setMoreOpen(true), [])
  const closeMore = useCallback(() => setMoreOpen(false), [])
  const resetNavigation = useCallback(() => {
    setMoreOpen(false)
    pendingNavigationRef.current = null
    setPendingNavigation(null)
    navigateApprovedPath('/', { replace: true })
  }, [navigateApprovedPath])

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
    resetNavigation,
    completeNavigation,
  }
}
