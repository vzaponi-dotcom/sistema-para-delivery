import { hasCapability } from '../../../app/access.js'

export const isOrderPaid = (order) => order?.paymentStatus === 'Pago'

export const getPendingAmount = (order) => isOrderPaid(order)
  ? 0
  : Math.max(0, Number(order?.total) || 0)

const sourceCapability = Object.freeze({
  orders: 'orders.view',
  history: 'orders.history',
})

const hasTableRelationship = (order) => Boolean(
  order?.type === 'Local'
  || order?.tableTabId
  || order?.customerIdentityType === 'table'
  || order?.table
  || order?.tableId
  || order?.tableIdentifier,
)

export function canReceiveStandaloneOrder(order, granted, source) {
  const viewCapability = sourceCapability[source]
  return Boolean(
    order
    && viewCapability
    && hasCapability(granted, viewCapability)
    && hasCapability(granted, 'payments.receive')
    && !isOrderPaid(order)
    && order.status !== 'Cancelado'
    && !hasTableRelationship(order),
  )
}
