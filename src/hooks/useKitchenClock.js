import { useEffect, useState } from 'react'
import { scheduleKitchenTransitions } from '../utils/kitchenClock.js'

export const getKitchenNowForRender = (storedNow, active, getNow = () => new Date()) => (
  active ? getNow() : storedNow
)

export function startKitchenClock(orders, onNow, dependencies = {}) {
  const getNow = dependencies.getNow || (() => new Date())
  const scheduleTransitions = dependencies.scheduleTransitions || scheduleKitchenTransitions
  const setFallbackInterval = dependencies.setInterval || globalThis.setInterval
  const clearFallbackInterval = dependencies.clearInterval || globalThis.clearInterval
  const documentTarget = dependencies.documentTarget || document
  const windowTarget = dependencies.windowTarget || globalThis
  const refresh = () => onNow(getNow())

  refresh()
  const clearTransitions = scheduleTransitions(orders, onNow)
  const fallback = setFallbackInterval(refresh, 60_000)
  const onVisibility = () => { if (documentTarget.visibilityState === 'visible') refresh() }
  documentTarget.addEventListener('visibilitychange', onVisibility)
  windowTarget.addEventListener('focus', refresh)

  return () => {
    clearTransitions()
    clearFallbackInterval(fallback)
    documentTarget.removeEventListener('visibilitychange', onVisibility)
    windowTarget.removeEventListener('focus', refresh)
  }
}

export function useKitchenClock(orders, { active = true } = {}) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!active) return undefined
    return startKitchenClock(orders, setNow)
  }, [active, orders])

  return getKitchenNowForRender(now, active)
}
