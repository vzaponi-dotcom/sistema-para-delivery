import { getPendingAmount, isOrderPaid } from './paymentWorkflow.js'

const isRegisteredClientOrder = (order) => Boolean(
  order?.clientId && (!order?.customerIdentityType || order.customerIdentityType === 'registered_client'),
)

const isTableTabOrder = (order) => order?.customerIdentityType === 'table' && Boolean(order?.tableTabId)

const groupKey = (order) => {
  if (isRegisteredClientOrder(order)) return `client:${order.clientId}`
  if (isTableTabOrder(order)) return `table-tab:${order.tableTabId}`
  return `order:${order?.id}`
}

export const groupPendingOrders = (orders = []) => {
  const grouped = new Map()

  for (const order of orders.filter((item) => !isOrderPaid(item))) {
    const key = groupKey(order)
    const current = grouped.get(key) ?? {
      key,
      kind: isTableTabOrder(order) ? 'table_tab' : isRegisteredClientOrder(order) ? 'registered_client' : 'order',
      tableTabId: isTableTabOrder(order) ? order.tableTabId : null,
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
