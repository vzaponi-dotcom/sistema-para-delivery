import { createContext, useContext, useMemo } from 'react'

export const ContextApi = createContext(null)
// Each factory closes over one immutable client. Retained callbacks keep that
// client; no request consults the current React context after it starts.
export function useContextApi(factory, supplied, legacy) {
  const client = useContext(ContextApi)
  return useMemo(() => client && (!supplied || supplied === legacy) ? factory(client) : supplied || legacy || factory(), [client, factory, supplied, legacy])
}
