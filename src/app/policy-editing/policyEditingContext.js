import { createContext, useContext } from 'react'

export const PolicyEditingContext = createContext(null)

export function usePolicyEditing() {
  const value = useContext(PolicyEditingContext)
  if (!value) throw new Error('usePolicyEditing must be used within PolicyEditingProvider')
  return value
}
