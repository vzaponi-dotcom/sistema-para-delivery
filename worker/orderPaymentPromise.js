import { getBusinessDate } from '../shared/finance.js'
import { loadOrderById } from './repositories.js'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const repositoryError = (status, code, message) => Object.assign(new Error(message), { status, code })

const isValidCalendarDate = (value) => {
  const match = ISO_DATE.exec(value)
  if (!match) return false
  const [, rawYear, rawMonth, rawDay] = match
  const year = Number(rawYear); const month = Number(rawMonth); const day = Number(rawDay)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

export const parsePromisedPaymentDate = (value, today) => {
  if (value == null || value === '') return null
  const normalized = String(value).trim()
  if (!isValidCalendarDate(normalized)) throw repositoryError(400, 'INVALID_PROMISED_PAYMENT_DATE', 'Data prometida inválida.')
  if (normalized < today) throw repositoryError(400, 'PROMISED_PAYMENT_DATE_IN_PAST', 'A data prometida não pode estar no passado.')
  return normalized
}

export const updateOrderPaymentPromise = async (db, businessId, orderId, rawDate, now = new Date()) => {
  const order = await loadOrderById(db, businessId, orderId)
  if (!order) throw repositoryError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
  if (order.status === 'Cancelado') throw repositoryError(409, 'ORDER_CANCELLED', 'Pedido cancelado não pode receber uma promessa de pagamento.')
  if (order.paymentStatus === 'Pago') throw repositoryError(409, 'ORDER_ALREADY_PAID', 'Pedido quitado não pode alterar a data prometida.')
  const promisedPaymentDate = parsePromisedPaymentDate(rawDate, getBusinessDate(now))
  await db.prepare('UPDATE orders SET promised_payment_date = ? WHERE id = ? AND business_id = ?')
    .bind(promisedPaymentDate, orderId, businessId).run()
  return loadOrderById(db, businessId, orderId)
}
