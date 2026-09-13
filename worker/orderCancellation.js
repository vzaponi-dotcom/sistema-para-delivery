import { getBusinessDate } from '../shared/finance.js'
import { mapMovementRow } from './financeRepository.js'
import { closeTableTabIfSettled } from './repositories.js'
import { centsToMoney, validatePaymentMethod } from './validation.js'
import { formatOrderDisplayNumber } from '../shared/orderDisplayNumber.js'
import { prepareCancellationUse } from './cancellationSettingsRepository.js'
import { clearSettingsAssertions, prepareSettingsAssertion } from './settingsTransactions.js'
import { preparePolicyGuards, readPaymentMethodExpectation, rethrowPolicyChange } from './operationalPolicyGuards.js'
import { loadOperations } from './operationSettingsRepository.js'
import { parseOrderTimingPolicySnapshot, serializeOrderTimingPolicySnapshot } from '../shared/orderTiming.js'

export const CANCEL_REASONS = ['client_changed_mind', 'duplicate_order', 'product_unavailable', 'entry_error', 'other']

const domainError = (status, code, message) => Object.assign(new Error(message), { status, code })

const normalizeReason = (value) => {
  const reason = typeof value === 'string' ? value.trim() : ''
  if (!reason || reason.length > 120) {
    throw domainError(400, 'ORDER_CANCEL_REASON_REQUIRED', 'Selecione um motivo válido para cancelar o pedido.')
  }
  return reason
}

const normalizeNote = (reason, value) => {
  const note = typeof value === 'string' ? value.trim() : ''
  if (reason === 'other' && !note) {
    throw domainError(400, 'ORDER_CANCEL_REASON_NOTE_REQUIRED', 'Descreva o motivo do cancelamento.')
  }
  if (note.length > 240) {
    throw domainError(400, 'ORDER_CANCEL_REASON_NOTE_TOO_LONG', 'A descrição do motivo deve ter no máximo 240 caracteres.')
  }
  return note
}

const readCancellationPolicy = (db, businessId, reason) => db.prepare(`SELECT h.revision, r.active, r.requires_note
  FROM business_cancellation_settings h
  LEFT JOIN business_cancel_reasons r ON r.business_id = h.business_id AND r.id = ?
  WHERE h.business_id = ? LIMIT 1`).bind(reason, businessId).first()

const normalizeRefundMethod = (value) => {
  const method = typeof value === 'string' ? value.trim() : ''
  if (!method) throw domainError(400, 'ORDER_REFUND_METHOD_REQUIRED', 'Informe a forma do estorno.')
  return validatePaymentMethod(method)
}

const orderContextSql = `SELECT o.id, o.order_number, o.status, o.table_tab_id, o.client_name_snapshot,
  o.cancelled_at, o.cancel_reason, o.cancel_reason_note, o.timing_policy_snapshot_json,
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
    orderNumber: row.order_number,
    client: row.client_name_snapshot,
    tableTabId: row.table_tab_id ?? null,
    status: row.status,
    cancelledAt: row.cancelled_at ?? null,
    cancelReason: row.cancel_reason ?? null,
    cancelReasonNote: row.cancel_reason_note ?? '',
    timingPolicySnapshot: parseOrderTimingPolicySnapshot(row.timing_policy_snapshot_json),
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
  const description = `${formatOrderDisplayNumber(row).replace('Pedido', 'Estorno pedido')} · ${row.client_name_snapshot}`
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
  const policy = await readCancellationPolicy(db, businessId, reason)
  if (!policy || policy.active !== 1) {
    if (policy?.active === 0) throw domainError(409, 'POLICY_CHANGED', 'O motivo de cancelamento não está mais ativo.')
    throw domainError(400, 'ORDER_CANCEL_REASON_REQUIRED', 'Selecione um motivo válido para cancelar o pedido.')
  }
  const expectedRevision = input.expectedRevision ?? policy.revision
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    throw domainError(400, 'ORDER_CANCEL_REASON_REVISION_REQUIRED', 'Atualize os motivos de cancelamento e tente novamente.')
  }
  const existing = await readContext(db, businessId, orderId)
  if (!existing) throw domainError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
  if (existing.status === 'Cancelado') throw domainError(409, 'ORDER_ALREADY_CANCELLED', 'Este pedido já foi cancelado.')
  if (!['Em preparo', 'Finalizado'].includes(existing.status)) {
    throw domainError(409, 'ORDER_CANCEL_NOT_ALLOWED', 'Este pedido não pode ser cancelado.')
  }

  parseOrderTimingPolicySnapshot(existing.timing_policy_snapshot_json)

  const operations = existing.status === 'Em preparo' ? await loadOperations(db, businessId) : null
  const timingSnapshot = operations ? serializeOrderTimingPolicySnapshot(operations.data.timing) : null

  const cancelledAt = now.toISOString()
  const update = db.prepare(`UPDATE orders SET status = 'Cancelado', cancelled_at = ?, cancel_reason = ?, cancel_reason_note = ?,
    timing_policy_snapshot_json = CASE WHEN status = 'Em preparo'
      THEN COALESCE(timing_policy_snapshot_json, ?) ELSE timing_policy_snapshot_json END
    WHERE id = ? AND business_id = ? AND status <> 'Cancelado'`).bind(
    cancelledAt,
    reason,
    note || null,
    timingSnapshot,
    orderId,
    businessId,
  )
  const deletePendingAutomaticPrint = db.prepare(`DELETE FROM print_jobs
    WHERE business_id = ? AND order_id = ? AND trigger = 'automatic' AND status = 'pending'`).bind(businessId, orderId)
  const txId = crypto.randomUUID()
  const [policyGuard, markReasonUsed] = prepareCancellationUse(db, businessId, reason, expectedRevision, txId, now)
  const orderGuard = prepareSettingsAssertion(db, txId, 'state',
    "EXISTS (SELECT 1 FROM orders WHERE id = ? AND business_id = ? AND status IN ('Em preparo', 'Finalizado'))",
    [orderId, businessId])
  const timingTxId = operations ? crypto.randomUUID() : null
  const timingGuards = operations ? [prepareSettingsAssertion(db, timingTxId, 'policy',
    'coalesce((SELECT revision FROM business_operation_settings WHERE business_id = ?), 0) = ?',
    [businessId, operations.revision])] : []
  const timingCleanup = operations ? [clearSettingsAssertions(db, timingTxId)] : []
  const classifyCommitFailure = async (error) => {
    if (String(error?.message).includes('POLICY_CHANGED')) {
      throw domainError(409, 'POLICY_CHANGED', 'As configurações operacionais foram alteradas. Atualize e tente novamente.')
    }
    if (String(error?.message).includes('SETTINGS_INVALID')) {
      const refreshed = await readContext(db, businessId, orderId)
      if (refreshed?.status === 'Cancelado') throw domainError(409, 'ORDER_ALREADY_CANCELLED', 'Este pedido já foi cancelado.')
      if (refreshed && !['Em preparo', 'Finalizado'].includes(refreshed.status)) {
        throw domainError(409, 'ORDER_CANCEL_NOT_ALLOWED', 'Este pedido não pode ser cancelado.')
      }
    }
    throw error
  }

  let refund = null
  if (existing.payment_id && input.refundNow) {
    const refundMethod = normalizeRefundMethod(input.refundMethod)
    const paymentExpectation = await readPaymentMethodExpectation(db, businessId, refundMethod)
    const paymentTxId = crypto.randomUUID()
    if (existing.refund_movement_id) throw domainError(409, 'ORDER_ALREADY_REFUNDED', 'Este pedido já foi estornado.')
    refund = createRefundStatement(db, businessId, existing, refundMethod, now)
    try {
      await db.batch([...preparePolicyGuards(db, businessId, { paymentMethods: paymentExpectation }, paymentTxId),
        ...timingGuards, policyGuard, orderGuard, markReasonUsed, update, deletePendingAutomaticPrint, refund.statement,
        clearSettingsAssertions(db, txId), ...timingCleanup, clearSettingsAssertions(db, paymentTxId)])
    } catch (error) {
      await classifyCommitFailure(error)
    }
  } else {
    try {
      await db.batch([...timingGuards, policyGuard, orderGuard, markReasonUsed, update, deletePendingAutomaticPrint,
        clearSettingsAssertions(db, txId), ...timingCleanup])
    } catch (error) {
      await classifyCommitFailure(error)
    }
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
  parseOrderTimingPolicySnapshot(existing.timing_policy_snapshot_json)

  const paymentExpectation = await readPaymentMethodExpectation(db, businessId, refundMethod)
  const paymentTxId = crypto.randomUUID()
  const refund = createRefundStatement(db, businessId, existing, refundMethod, now)
  try {
    await db.batch([...preparePolicyGuards(db, businessId, { paymentMethods: paymentExpectation }, paymentTxId),
      refund.statement, clearSettingsAssertions(db, paymentTxId)])
  } catch (error) {
    const refreshed = await readContext(db, businessId, orderId)
    if (refreshed?.refund_movement_id) throw domainError(409, 'ORDER_ALREADY_REFUNDED', 'Este pedido já foi estornado.')
    if (String(error?.message || '').includes('POLICY_CHANGED')) rethrowPolicyChange(error)
    throw error
  }

  return {
    order: mapContext(await readContext(db, businessId, orderId)),
    movement: refund.movement,
  }
}
