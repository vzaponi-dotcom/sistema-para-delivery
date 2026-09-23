import { useEffect } from 'react'

export function useNewOrderUnloadGuard({
  active,
  dirty,
  checkoutPending,
}) {
  const shouldWarn = Boolean(active && (dirty || checkoutPending))

  useEffect(() => {
    if (!shouldWarn || typeof window === 'undefined') return undefined

    const warnBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [shouldWarn])
}
