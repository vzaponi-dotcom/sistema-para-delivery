import { useEffect, useState } from 'react'

export const readOnlineStatus = (navigatorObject = globalThis.navigator) => (
  navigatorObject == null ? true : navigatorObject.onLine !== false
)

export const subscribeOnlineStatus = (windowObject, callback) => {
  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)
  windowObject.addEventListener('online', handleOnline)
  windowObject.addEventListener('offline', handleOffline)
  return () => {
    windowObject.removeEventListener('online', handleOnline)
    windowObject.removeEventListener('offline', handleOffline)
  }
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => readOnlineStatus())
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    return subscribeOnlineStatus(window, setIsOnline)
  }, [])
  return isOnline
}
