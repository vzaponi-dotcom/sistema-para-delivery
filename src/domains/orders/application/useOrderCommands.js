import { useMutationOwner } from '../../../app/runtime/session/useMutationOwner.js'
import { useLayoutEffect, useState } from 'react'

export function useOrderCommands({
  orders,
  api,
  canFinalizeOrders,
  canCancelOrders,
  canRefundPayments,
  writesBlocked,
  applyOfficialEffects,
  onSuccess,
  onError,
}) {
  const ownsMutation = useMutationOwner(applyOfficialEffects)
  const [actionKey, setActionKey] = useState(null)
  useLayoutEffect(() => { setActionKey(null) }, [applyOfficialEffects])

  const finalizeOrder = async (orderId) => {
    if (!canFinalizeOrders || writesBlocked || actionKey) return false
    const currentOrder = orders.find((item) => item.id === orderId)
    if (!currentOrder) return false
    setActionKey(`order:status:${orderId}`)
    try {
      const effects = await api.updateOrderStatus(orderId, 'Finalizado')
      if (!ownsMutation()) return false

      if (applyOfficialEffects(effects) === false) return false
      onSuccess(currentOrder.type === 'Entrega' ? 'Pedido saiu para entrega' : 'Pedido finalizado')
      return true
    } catch (error) {
      if (!ownsMutation()) return false
      onError(error)
      return false
    } finally {
      if (ownsMutation()) setActionKey(null)
    }
  }

  const cancelOrder = async (orderId, payload) => {
    if (!canCancelOrders || (payload?.refundNow && !canRefundPayments) || writesBlocked || actionKey) return false
    setActionKey(`order:cancel:${orderId}`)
    try {
      const result = await api.cancelOrder(orderId, payload)
      if (!ownsMutation()) return false

      if (applyOfficialEffects(result) === false) return false
      onSuccess(payload?.refundNow ? 'Pedido cancelado e estorno registrado' : 'Pedido cancelado com sucesso')
      return true
    } catch (error) {
      if (!ownsMutation()) return false
      onError(error)
      return false
    } finally {
      if (ownsMutation()) setActionKey(null)
    }
  }

  return {
    actionKey,
    pending: actionKey !== null,
    finalizeOrder,
    cancelOrder,
  }
}
