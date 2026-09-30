import { useMutationOwner } from '../../../app/runtime/session/useMutationOwner.js'
import { useCallback } from 'react'
import { customersApi } from '../infrastructure/customersApi.js'

export function useCustomerCommands({
  api = customersApi,
  applyOfficialEffects = () => {},
  writesBlocked = false,
  canCreateClients = false,
  canUpdateClients = false,
  canDeleteClients = false,
  setRequestKey = () => {},
  onSuccess = () => {},
  onError = () => {},
} = {}) {
  const ownsMutation = useMutationOwner(applyOfficialEffects)
  const createClient = useCallback(async (payload) => {
    if (!canCreateClients || writesBlocked) return null
    setRequestKey('client:create')
    try {
      const { client } = await api.createClient(payload)
      if (!ownsMutation()) return false

      if (applyOfficialEffects({ client }) === false) return false
      onSuccess('Cliente adicionado com sucesso')
      return client ?? null
    } catch (error) {
      if (!ownsMutation()) return false
      onError(error)
      return null
    } finally {
      if (ownsMutation()) setRequestKey(null)
    }
  }, [ownsMutation, api, applyOfficialEffects, canCreateClients, onError, onSuccess, setRequestKey, writesBlocked])

  const quickCreateClient = useCallback(async (payload) => {
    if (!canCreateClients || writesBlocked) return null
    setRequestKey('client:create:quick')
    try {
      const { client } = await api.createClient(payload)
      if (!ownsMutation()) return false

      if (applyOfficialEffects({ client }) === false) return false
      return client ?? null
    } catch (error) {
      if (!ownsMutation()) return false
      onError(error)
      return null
    } finally {
      if (ownsMutation()) setRequestKey(null)
    }
  }, [ownsMutation, api, applyOfficialEffects, canCreateClients, onError, setRequestKey, writesBlocked])

  const updateClient = useCallback(async (clientId, payload) => {
    if (!canUpdateClients || writesBlocked) return null
    setRequestKey(`client:update:${clientId}`)
    try {
      const { client } = await api.updateClient(clientId, payload)
      if (!ownsMutation()) return false

      if (applyOfficialEffects({ client }) === false) return false
      onSuccess('Cliente atualizado com sucesso')
      return client ?? null
    } catch (error) {
      if (!ownsMutation()) return false
      onError(error)
      return null
    } finally {
      if (ownsMutation()) setRequestKey(null)
    }
  }, [ownsMutation, api, applyOfficialEffects, canUpdateClients, onError, onSuccess, setRequestKey, writesBlocked])

  const deleteClient = useCallback(async (clientId) => {
    if (!canDeleteClients || writesBlocked) return false
    setRequestKey(`client:delete:${clientId}`)
    try {
      await api.deleteClient(clientId)
      if (!ownsMutation()) return false

      if (applyOfficialEffects({ deletedClientId: clientId }) === false) return false
      onSuccess('Cliente excluído com sucesso')
      return true
    } catch (error) {
      if (!ownsMutation()) return false
      onError(error)
      return false
    } finally {
      if (ownsMutation()) setRequestKey(null)
    }
  }, [ownsMutation, api, applyOfficialEffects, canDeleteClients, onError, onSuccess, setRequestKey, writesBlocked])

  return {
    createClient,
    quickCreateClient,
    updateClient,
    deleteClient,
  }
}
