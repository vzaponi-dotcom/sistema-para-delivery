import { useCallback } from 'react'
import { customersApi } from '../infrastructure/customersApi.js'

export function useCustomerCommands({
  api = customersApi,
  applyOfficialEffects = () => {},
  writesBlocked = false,
  canManageClients = false,
  setRequestKey = () => {},
  onSuccess = () => {},
  onError = () => {},
} = {}) {
  const createClient = useCallback(async (payload) => {
    if (!canManageClients || writesBlocked) return null
    setRequestKey('client:create')
    try {
      const { client } = await api.createClient(payload)
      applyOfficialEffects({ client })
      onSuccess('Cliente adicionado com sucesso')
      return client ?? null
    } catch (error) {
      onError(error)
      return null
    } finally {
      setRequestKey(null)
    }
  }, [api, applyOfficialEffects, canManageClients, onError, onSuccess, setRequestKey, writesBlocked])

  const quickCreateClient = useCallback(async (payload) => {
    if (!canManageClients || writesBlocked) return null
    setRequestKey('client:create:quick')
    try {
      const { client } = await api.createClient(payload)
      applyOfficialEffects({ client })
      return client ?? null
    } catch (error) {
      onError(error)
      return null
    } finally {
      setRequestKey(null)
    }
  }, [api, applyOfficialEffects, canManageClients, onError, setRequestKey, writesBlocked])

  const updateClient = useCallback(async (clientId, payload) => {
    if (!canManageClients || writesBlocked) return null
    setRequestKey(`client:update:${clientId}`)
    try {
      const { client } = await api.updateClient(clientId, payload)
      applyOfficialEffects({ client })
      onSuccess('Cliente atualizado com sucesso')
      return client ?? null
    } catch (error) {
      onError(error)
      return null
    } finally {
      setRequestKey(null)
    }
  }, [api, applyOfficialEffects, canManageClients, onError, onSuccess, setRequestKey, writesBlocked])

  const deleteClient = useCallback(async (clientId) => {
    if (!canManageClients || writesBlocked) return false
    setRequestKey(`client:delete:${clientId}`)
    try {
      await api.deleteClient(clientId)
      applyOfficialEffects({ deletedClientId: clientId })
      onSuccess('Cliente excluído com sucesso')
      return true
    } catch (error) {
      onError(error)
      return false
    } finally {
      setRequestKey(null)
    }
  }, [api, applyOfficialEffects, canManageClients, onError, onSuccess, setRequestKey, writesBlocked])

  return {
    createClient,
    quickCreateClient,
    updateClient,
    deleteClient,
  }
}
