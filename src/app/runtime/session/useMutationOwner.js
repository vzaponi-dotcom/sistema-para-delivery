import { useCallback, useEffect, useRef } from 'react'

// The official effects callback captures the verified access owner and sync guard.
// Check its identity before publishing any result, feedback, or request state.
export function useMutationOwner(effects) {
  const current = useRef(effects)
  current.current = effects
  useEffect(() => {
    current.current = effects
    return () => { current.current = null }
  }, [effects])
  return useCallback(() => current.current === effects, [effects])
}
