import { apiError } from '../http.js'
import { getBusinessDate } from '../../shared/finance.js'

const forbidden = () => apiError(403, 'FORBIDDEN', 'Você não tem permissão para realizar esta ação.')
export function requireCapability(context, key) {
  if (!context?.granted?.has(key)) throw forbidden()
}
export function requireAnyCapability(context, keys) {
  if (!keys.some((key) => context?.granted?.has(key))) throw forbidden()
}
export function authorizeOrderCreate(context, input, now = new Date()) {
  requireCapability(context, 'orders.create')
  if (input.paymentAllocations !== undefined && input.paymentAllocations !== null) requireCapability(context, 'payments.receive')
  // The canonical none envelope is emitted by ordinary checkout. A real
  // adjustment requires permission even when its amount is explicitly zero.
  if (input.adjustment && input.adjustment.type !== undefined && input.adjustment.type !== 'none') requireCapability(context, 'orders.discount')
  if (input.isBackdated || (typeof input.orderDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.orderDate) && input.orderDate < getBusinessDate(now))) {
    requireCapability(context, 'orders.backdate')
  }
}
