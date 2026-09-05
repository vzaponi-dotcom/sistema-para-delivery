import { useEffect, useState } from 'react'
import { scheduleKitchenTransitions } from '../utils/kitchenClock.js'

export function useKitchenClock(orders, { active = true } = {}) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!active) return undefined
    const refresh = () => setNow(new Date())
    const clearTransitions = scheduleKitchenTransitions(orders, refresh)
    const fallback = globalThis.setInterval(refresh, 60_000)
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisibility)
    globalThis.addEventListener('focus', refresh)
    return () => {
      clearTransitions()
      globalThis.clearInterval(fallback)
      document.removeEventListener('visibilitychange', onVisibility)
      globalThis.removeEventListener('focus', refresh)
    }
  }, [active, orders])

  return now
}
