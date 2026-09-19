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
  const updatePaymentPromise = useCallback(async (orderId, promisedPaymentDate) => {
    if (!canManagePaymentPromises || writesBlocked) return false
    setRequestKey(`payment-promise:${orderId}`)
    try {
      const { order } = await api.updatePaymentPromise(orderId, promisedPaymentDate)
      applyOfficialEffects({ order })
      onSuccess(promisedPaymentDate ? 'Data prometida atualizada' : 'Data prometida removida')
      return true
    } catch (error) {
      onError(error)
      return false
    } finally {
      setRequestKey(null)
    }
  }, [
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
