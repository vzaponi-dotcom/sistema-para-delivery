import { useCallback, useMemo, useSyncExternalStore } from 'react'

const serverSnapshot = () => false

export function useMediaQuery(query) {
  const media = useMemo(() => typeof window === 'undefined' ? null : window.matchMedia?.(query), [query])
  const subscribe = useCallback((onChange) => {
    media?.addEventListener('change', onChange)
    return () => media?.removeEventListener('change', onChange)
  }, [media])
  const getSnapshot = useCallback(() => Boolean(media?.matches), [media])
  return useSyncExternalStore(subscribe, getSnapshot, serverSnapshot)
}
