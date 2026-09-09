import { formatOrderDate, toLocalDateValue } from './orderWorkflow.js'

const parseDate = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

import { formatOrderDisplayNumber } from '../../shared/orderDisplayNumber.js'

export const normalizePayment = (order) => {
  const isPaid = order?.paymentStatus === 'Pago'
  const parsedPaidAt = parseDate(order?.paidAt)
  const total = Number(order?.total) || 0
  const paidAmount = isPaid ? Number(order?.paidAmount) || total : 0

  return {
    ...order,
    paymentStatus: isPaid ? 'Pago' : 'Pendente',
    paymentMethod: isPaid ? order?.paymentMethod || 'Não informado' : null,
    paidAt: isPaid && parsedPaidAt ? parsedPaidAt.toISOString() : null,
    paidAmount,
  }
}

export const isOrderPaid = (order) => order?.paymentStatus === 'Pago'

export const getPendingAmount = (order) => {
  if (isOrderPaid(order)) return 0
  return Math.max(0, Number(order?.total) || 0)
}

export const calculateReceivedToday = (movements = [], dateValue = toLocalDateValue()) => (Array.isArray(movements) ? movements : [])
  .reduce((total, movement) => {
    const createdAt = parseDate(movement?.createdAt)
    if (!createdAt || toLocalDateValue(createdAt) !== dateValue) return total
    const value = Math.max(0, Number(movement?.value) || 0)
    if (movement?.type === 'entrada' && movement?.source === 'order-payment') return total + value
    if (movement?.type === 'saida' && movement?.source === 'order-refund') return total - value
    return total
  }, 0)

export const createOrderPaymentMovement = (order, paymentMethod, paidAt = new Date(), id = Date.now()) => {
  const paymentDate = new Date(paidAt)
  const safePaidAt = Number.isNaN(paymentDate.getTime()) ? new Date() : paymentDate
  const localDate = toLocalDateValue(safePaidAt)

  return {
    id,
    type: 'entrada',
    category: 'Vendas',
    description: `${formatOrderDisplayNumber(order).replace('Pedido', 'Pagamento pedido')} · ${order?.client || 'Cliente'}`,
    value: Number(order?.total) || 0,
    date: formatOrderDate(localDate),
    paymentMethod,
    source: 'order-payment',
    orderId: order?.id,
    createdAt: safePaidAt.toISOString(),
  }
}
