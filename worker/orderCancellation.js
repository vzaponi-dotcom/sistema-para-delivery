import { getBusinessDate } from '../shared/finance.js'
import { mapMovementRow } from './financeRepository.js'
import { closeTableTabIfSettled } from './repositories.js'
import { centsToMoney, validatePaymentMethod } from './validation.js'

export const CANCEL_REASONS = ['client_changed_mind', 'duplicate_order', 'product_unavailable', 'entry_error', 'other']

const domainError = (status, code, message) => Object.assign(new Error(message), { status, code })

const normalizeReason = (value) => {
  const reason = typeof value === 'string' ? value.trim() : ''
  if (!CANCEL_REASONS.includes(reason)) {
    throw domainError(400, 'ORDER_CANCEL_REASON_REQUIRED', 'Selecione um motivo válido para cancelar o pedido.')
  }
  return reason
}

const normalizeNote = (reason, value) => {
  const note = typeof value === 'string' ? value.trim() : ''
  if (reason === 'other' && !note) {
    throw domainError(400, 'ORDER_CANCEL_REASON_NOTE_REQUIRED', 'Descreva o motivo do cancelamento.')
  }
  return note
}

const normalizeRefundMethod = (value) => {
  const method = typeof value === 'string' ? value.trim() : ''
  if (!method) throw domainError(400, 'ORDER_REFUND_METHOD_REQUIRED', 'Informe a forma do estorno.')
  return validatePaymentMethod(method)
}

const orderContextSql = `SELECT o.id, o.status, o.table_tab_id, o.client_name_snapshot,
  o.cancelled_at, o.cancel_reason, o.cancel_reason_note,
  p.id AS payment_id, p.method AS payment_method, p.amount_cents AS paid_amount_cents, p.paid_at,
  r.id AS refund_movement_id, r.created_at AS refund_created_at
  FROM orders o
  LEFT JOIN payments p ON p.order_id = o.id AND p.business_id = o.business_id
  LEFT JOIN movements r ON r.order_id = o.id AND r.business_id = o.business_id AND r.source = 'order-refund'
  WHERE o.id = ? AND o.business_id = ? LIMIT 1`

const readContext = (db, businessId, orderId) => db.prepare(orderContextSql).bind(orderId, businessId).first()

const mapContext = (row) => {
  if (!row) return null
  const order = {
    id: row.id,
    client: row.client_name_snapshot,
    tableTabId: row.table_tab_id ?? null,
    status: row.status,
    cancelledAt: row.cancelled_at ?? null,
    cancelReason: row.cancel_reason ?? null,
    cancelReasonNote: row.cancel_reason_note ?? '',
    paymentStatus: row.payment_id ? 'Pago' : 'Pendente',
    paymentId: row.payment_id ?? null,
    paymentMethod: row.payment_method ?? null,
    paidAmount: row.payment_id ? centsToMoney(row.paid_amount_cents) : 0,
    paidAt: row.paid_at ?? null,
    refundMovementId: row.refund_movement_id ?? null,
    refundedAt: row.refund_created_at ?? null,
  }
  return { ...order, refundState: getOrderRefundState(order) }
}

export const getOrderRefundState = (order) => {
  if (order?.status !== 'Cancelado' || !order?.paymentId) return 'none'
  return order?.refundMovementId ? 'refunded' : 'pending'
}

const createRefundStatement = (db, businessId, row, refundMethod, now) => {
  const id = crypto.randomUUID()
  const createdAt = now.toISOString()
  const movementDate = getBusinessDate(now)
  const description = `Estorno pedido #${String(row.id).slice(-4)} · ${row.client_name_snapshot}`
  const statement = db.prepare(`INSERT INTO movements (id, business_id, type, category, description, value_cents, source, order_id, payment_id, movement_date, created_at, payment_method, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id,
    businessId,
    'saida',
    'Estornos',
    `${description} · ${refundMethod}`,
    row.paid_amount_cents,
    'order-refund',
    row.id,
    row.payment_id,
    movementDate,
    createdAt,
    refundMethod,
    createdAt,
  )
  return {
    statement,
    movement: mapMovementRow({
      id,
      type: 'saida',
      category: 'Estornos',
      description: `${description} · ${refundMethod}`,
      value_cents: row.paid_amount_cents,
      source: 'order-refund',
      order_id: row.id,
      payment_id: row.payment_id,
      payment_method: refundMethod,
      movement_date: movementDate,
      created_at: createdAt,
      updated_at: createdAt,
    }),
  }
}

export const cancelOrder = async (db, businessId, orderId, input = {}, now = new Date()) => {
  const reason = normalizeReason(input.reason)
  const note = normalizeNote(reason, input.note)
  const existing = await readContext(db, businessId, orderId)
  if (!existing) throw domainError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
  if (existing.status === 'Cancelado') throw domainError(409, 'ORDER_ALREADY_CANCELLED', 'Este pedido já foi cancelado.')
  if (!['Em preparo', 'Finalizado'].includes(existing.status)) {
    throw domainError(409, 'ORDER_CANCEL_NOT_ALLOWED', 'Este pedido não pode ser cancelado.')
  }

  const cancelledAt = now.toISOString()
  const update = db.prepare(`UPDATE orders SET status = 'Cancelado', cancelled_at = ?, cancel_reason = ?, cancel_reason_note = ? WHERE id = ? AND business_id = ? AND status <> 'Cancelado'`).bind(
    cancelledAt,
    reason,
    note || null,
    orderId,
    businessId,
  )
  const deletePendingAutomaticPrint = db.prepare(`DELETE FROM print_jobs
    WHERE business_id = ? AND order_id = ? AND trigger = 'automatic' AND status = 'pending'`).bind(businessId, orderId)

  let refund = null
  if (existing.payment_id && input.refundNow) {
    const refundMethod = normalizeRefundMethod(input.refundMethod)
    if (existing.refund_movement_id) throw domainError(409, 'ORDER_ALREADY_REFUNDED', 'Este pedido já foi estornado.')
    refund = createRefundStatement(db, businessId, existing, refundMethod, now)
    await db.batch([update, deletePendingAutomaticPrint, refund.statement])
  } else {
    await db.batch([update, deletePendingAutomaticPrint])
  }

  const tableTab = await closeTableTabIfSettled(db, businessId, existing.table_tab_id, now)
  return {
    order: mapContext(await readContext(db, businessId, orderId)),
    movement: refund?.movement ?? null,
    tableTab,
  }
}

export const registerOrderRefund = async (db, businessId, orderId, input = {}, now = new Date()) => {
  const refundMethod = normalizeRefundMethod(input.refundMethod)
  const existing = await readContext(db, businessId, orderId)
  if (!existing) throw domainError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
  if (existing.status !== 'Cancelado' || !existing.payment_id) {
    throw domainError(409, 'ORDER_REFUND_NOT_ALLOWED', 'O estorno só pode ser registrado para um pedido cancelado e pago.')
  }
  if (existing.refund_movement_id) throw domainError(409, 'ORDER_ALREADY_REFUNDED', 'Este pedido já foi estornado.')

  const refund = createRefundStatement(db, businessId, existing, refundMethod, now)
  try {
    await refund.statement.run()
  } catch (error) {
    const refreshed = await readContext(db, businessId, orderId)
    if (refreshed?.refund_movement_id) throw domainError(409, 'ORDER_ALREADY_REFUNDED', 'Este pedido já foi estornado.')
    throw error
  }

  return {
    order: mapContext(await readContext(db, businessId, orderId)),
    movement: refund.movement,
  }
}
