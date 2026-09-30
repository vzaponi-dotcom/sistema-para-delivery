import { useCallback } from 'react'
import { useCustomerCommands } from './useCustomerCommands.js'

export function useQuickCreateCustomerCommand({
  api,
  applyOfficialEffects = () => {},
  writesBlocked = false,
  canCreateClients = false,
  setRequestKey = () => {},
  onError = () => {},
} = {}) {
  const { quickCreateClient } = useCustomerCommands({
    api,
    applyOfficialEffects,
    writesBlocked,
    canCreateClients,
    setRequestKey,
    onError,
  })

  return useCallback(async ({ name, phone } = {}) => {
    if (!canCreateClients || writesBlocked || typeof name !== 'string' || !name.trim()) return null
    return quickCreateClient({
      name: name.trim(),
      phone: phone || '',
      address: '',
    })
  }, [canCreateClients, quickCreateClient, writesBlocked])
}
