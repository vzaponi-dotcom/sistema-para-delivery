import { useEffect, useRef } from 'react'

export function useNavigationEventBridge(requestNavigation) {
  const navigateRef = useRef(requestNavigation)

  useEffect(() => {
    navigateRef.current = requestNavigation
  }, [requestNavigation])

  useEffect(() => {
    const handleNavigate = (event) => {
      if (typeof event?.detail === 'string') navigateRef.current?.(event.detail)
    }

    window.addEventListener('app:navigate', handleNavigate)
    return () => window.removeEventListener('app:navigate', handleNavigate)
  }, [])
}
