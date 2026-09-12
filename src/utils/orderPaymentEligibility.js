import { hasCapability } from '../app/access.js'

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
    && order.paymentStatus === 'Pendente'
    && order.status !== 'Cancelado'
    && !hasTableRelationship(order),
  )
}
