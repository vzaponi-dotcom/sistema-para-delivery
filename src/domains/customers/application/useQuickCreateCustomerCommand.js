import { useCallback } from 'react'
import { useCustomerCommands } from './useCustomerCommands.js'

export function useQuickCreateCustomerCommand({
  api,
  applyOfficialEffects = () => {},
  writesBlocked = false,
  canManageClients = false,
  setRequestKey = () => {},
  onError = () => {},
} = {}) {
  const { quickCreateClient } = useCustomerCommands({
    api,
    applyOfficialEffects,
    writesBlocked,
    canManageClients,
    setRequestKey,
    onError,
  })

  return useCallback(async ({ name, phone } = {}) => {
    if (!canManageClients || writesBlocked || typeof name !== 'string' || !name.trim()) return null
    return quickCreateClient({
      name: name.trim(),
      phone: phone || '',
      address: '',
    })
  }, [canManageClients, quickCreateClient, writesBlocked])
}
