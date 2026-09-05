import { getOperationalStartAt } from '../../shared/orderTiming.js'
import { isOrderActive } from './orderLifecycle.js'

export const getNextKitchenTransitionAt = (orders = [], now = new Date()) => {
  const reference = new Date(now)
  const candidates = orders
    .filter(isOrderActive)
    .map((order) => getOperationalStartAt(order))
    .filter((value) => value && value.getTime() > reference.getTime())
    .sort((left, right) => left.getTime() - right.getTime())
  return candidates[0] || null
}

export function scheduleKitchenTransitions(orders, onBoundary, timers = {}) {
  const getNow = timers.getNow || (() => new Date())
  const setExactTimeout = timers.setTimeout || globalThis.setTimeout
  const clearExactTimeout = timers.clearTimeout || globalThis.clearTimeout
  let currentTimeoutId = null
  let stopped = false

  const armNext = () => {
    if (stopped) return
    const now = getNow()
    const next = getNextKitchenTransitionAt(orders, now)
    if (!next) return
    currentTimeoutId = setExactTimeout(() => {
      currentTimeoutId = null
      if (stopped) return
      const boundaryNow = getNow()
      onBoundary(boundaryNow)
      armNext()
    }, Math.max(0, next.getTime() - now.getTime()))
  }

  armNext()
  return () => {
    stopped = true
    if (currentTimeoutId !== null) clearExactTimeout(currentTimeoutId)
    currentTimeoutId = null
  }
}
