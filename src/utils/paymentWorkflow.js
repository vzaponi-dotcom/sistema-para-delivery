import { formatOrderDate, toLocalDateValue } from './orderWorkflow.js'

const parseDate = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const orderNumber = (id) => String(id ?? '').slice(-4)

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

export const createOrderPaymentMovement = (order, paymentMethod, paidAt = new Date(), id = Date.now()) => {
  const paymentDate = new Date(paidAt)
  const safePaidAt = Number.isNaN(paymentDate.getTime()) ? new Date() : paymentDate
  const localDate = toLocalDateValue(safePaidAt)

  return {
    id,
    type: 'entrada',
    category: 'Vendas',
    description: `Pagamento pedido #${orderNumber(order?.id)} · ${order?.client || 'Cliente'}`,
    value: Number(order?.total) || 0,
    date: formatOrderDate(localDate),
    paymentMethod,
    source: 'order-payment',
    orderId: order?.id,
    createdAt: safePaidAt.toISOString(),
  }
}
