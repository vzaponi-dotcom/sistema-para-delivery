import { getPendingAmount, isOrderPaid } from './paymentWorkflow.js'

const groupKey = (order) => {
  if (order?.customerIdentityType === 'registered_client' && order?.clientId) return `client:${order.clientId}`
  return `order:${order?.id}`
}

export const groupPendingOrders = (orders = []) => {
  const grouped = new Map()

  for (const order of orders.filter((item) => !isOrderPaid(item))) {
    const key = groupKey(order)
    const current = grouped.get(key) ?? {
      key,
      label: order.client || 'Pedido sem identificação',
      identityType: order.customerIdentityType || (order.clientId ? 'registered_client' : 'guest_name'),
      orders: [],
      total: 0,
    }
    current.orders.push(order)
    current.total += getPendingAmount(order)
    grouped.set(key, current)
  }

  return [...grouped.values()].sort((a, b) => b.total - a.total)
}
