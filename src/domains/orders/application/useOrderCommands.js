import { useState } from 'react'

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
  const [actionKey, setActionKey] = useState(null)

  const finalizeOrder = async (orderId) => {
    if (!canFinalizeOrders || writesBlocked || actionKey) return false
    const currentOrder = orders.find((item) => item.id === orderId)
    if (!currentOrder) return false
    setActionKey(`order:status:${orderId}`)
    try {
      const { order } = await api.updateOrderStatus(orderId, 'Finalizado')
      applyOfficialEffects({ order })
      onSuccess(currentOrder.type === 'Entrega' ? 'Pedido saiu para entrega' : 'Pedido finalizado')
      return true
    } catch (error) {
      onError(error)
      return false
    } finally {
      setActionKey(null)
    }
  }

  const cancelOrder = async (orderId, payload) => {
    if (!canCancelOrders || (payload?.refundNow && !canRefundPayments) || writesBlocked || actionKey) return false
    setActionKey(`order:cancel:${orderId}`)
    try {
      const result = await api.cancelOrder(orderId, payload)
      applyOfficialEffects(result)
      onSuccess(payload?.refundNow ? 'Pedido cancelado e estorno registrado' : 'Pedido cancelado com sucesso')
      return true
    } catch (error) {
      onError(error)
      return false
    } finally {
      setActionKey(null)
    }
  }

  return {
    actionKey,
    pending: actionKey !== null,
    finalizeOrder,
    cancelOrder,
  }
}
