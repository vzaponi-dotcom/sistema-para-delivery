import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { AREA_DESTINATION_IDS, destinationById } from './registry.js'
import { resolveArea, resolveDestination, resolveHome } from './resolution.js'
import { pathForDestination } from './routes.js'
import { useMatchedDestination } from './routeMatch.js'

const FEEDBACK = Object.freeze({
  unknown: 'Destino desconhecido.',
  denied: 'Você não tem acesso a este destino.',
  unavailable: 'Este destino ainda não está disponível.',
})

export function resolveRouteCorrection({
  pathname,
  matchedDestination,
  granted,
  implemented,
}) {
  if (pathname === '/') {
    const home = resolveHome(granted, implemented)
    return home ? { destination: home, feedbackStatus: null } : null
  }

  if (!matchedDestination) {
    const home = resolveHome(granted, implemented)
    return home ? { destination: home, feedbackStatus: 'unknown' } : null
  }

  const resolution = resolveDestination(matchedDestination, granted, implemented)
  if (resolution.status === 'allowed') return null

  const destination = destinationById.get(matchedDestination)
  const areaIds = AREA_DESTINATION_IDS[destination?.area] || []
  const isAreaRoot = areaIds[0] === matchedDestination
  const areaFallback = isAreaRoot
    ? resolveArea(destination.area, granted, implemented)
    : null
  const fallback = areaFallback || resolveHome(granted, implemented)
  if (!fallback) return null

  return {
    destination: fallback,
    feedbackStatus: areaFallback ? null : resolution.status,
  }
}

export function useRouteGate({
  ready,
  granted,
  implemented,
  onFeedback,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const matchedDestination = useMatchedDestination()

  useEffect(() => {
    if (!ready) return

    const correction = resolveRouteCorrection({
      pathname: location.pathname,
      matchedDestination,
      granted,
      implemented,
    })
    if (!correction) return

    const targetPath = pathForDestination(correction.destination)
    if (!targetPath || targetPath === location.pathname) return

    if (correction.feedbackStatus) {
      onFeedback?.(FEEDBACK[correction.feedbackStatus] || FEEDBACK.denied)
    }
    navigate(targetPath, { replace: true })
  }, [
    granted,
    implemented,
    location.pathname,
    matchedDestination,
    navigate,
    onFeedback,
    ready,
  ])
}
