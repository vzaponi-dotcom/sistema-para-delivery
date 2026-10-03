import { useContextApi } from '../../../infrastructure/api/ContextApi.js'
import { useMutationOwner } from '../../../app/runtime/session/useMutationOwner.js'
import { useCallback } from 'react'
import { ordersApi, createOrdersApi } from '../infrastructure/ordersApi.js'

export function useOrderPaymentPromise({
  api: suppliedApi = ordersApi,
  applyOfficialEffects = () => {},
  writesBlocked = false,
  canManagePaymentPromises = false,
  setRequestKey = () => {},
  onSuccess = () => {},
  onError = () => {},
} = {}) {
  const api = useContextApi(createOrdersApi, suppliedApi, ordersApi)
  const ownsMutation = useMutationOwner(applyOfficialEffects)
  const updatePaymentPromise = useCallback(async (orderId, promisedPaymentDate) => {
    if (!canManagePaymentPromises || writesBlocked) return false
    setRequestKey(`payment-promise:${orderId}`)
    try {
      const effects = await api.updatePaymentPromise(orderId, promisedPaymentDate)
      if (!ownsMutation()) return false
      if (applyOfficialEffects(effects) === false) return false
      onSuccess(promisedPaymentDate ? 'Data prometida atualizada' : 'Data prometida removida')
      return true
    } catch (error) {
      if (!ownsMutation()) return false
      onError(error)
      return false
    } finally {
      if (ownsMutation()) setRequestKey(null)
    }
  }, [
    ownsMutation,
    api,
    applyOfficialEffects,
    canManagePaymentPromises,
    onError,
    onSuccess,
    setRequestKey,
    writesBlocked,
  ])

  return { updatePaymentPromise }
}
