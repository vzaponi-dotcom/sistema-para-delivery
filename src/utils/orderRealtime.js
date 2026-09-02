const FINISHED_STATUSES = new Set(['Finalizado', 'Entregue', 'Despachado'])

const isActiveOrder = (order) => Boolean(order?.id) && !order?.finishedAt && !FINISHED_STATUSES.has(order?.status)

export const activeOrderIdSet = (orders = []) => new Set(
  orders.filter(isActiveOrder).map((order) => String(order.id)),
)

export const getNewActiveOrderIds = (previousIds, orders = []) => {
  const knownIds = previousIds instanceof Set ? previousIds : new Set(previousIds ?? [])
  return [...activeOrderIdSet(orders)].filter((id) => !knownIds.has(id))
}
