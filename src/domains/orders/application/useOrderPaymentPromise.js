import { useMutationOwner } from '../../../app/runtime/session/useMutationOwner.js'
import { useCallback } from 'react'
import { ordersApi } from '../infrastructure/ordersApi.js'

export function useOrderPaymentPromise({
  api = ordersApi,
  applyOfficialEffects = () => {},
  writesBlocked = false,
  canManagePaymentPromises = false,
  setRequestKey = () => {},
  onSuccess = () => {},
  onError = () => {},
} = {}) {
  const ownsMutation = useMutationOwner(applyOfficialEffects)
  const updatePaymentPromise = useCallback(async (orderId, promisedPaymentDate) => {
    if (!canManagePaymentPromises || writesBlocked) return false
    setRequestKey(`payment-promise:${orderId}`)
    try {
      const { order } = await api.updatePaymentPromise(orderId, promisedPaymentDate)
      if (!ownsMutation()) return false
      if (applyOfficialEffects({ order }) === false) return false
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
