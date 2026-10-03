import { businessEvent } from './access/audit.js'
import { getBusinessDate } from '../shared/finance.js'
import { loadOrderById } from './repositories.js'
import { loadTableReservationById } from './tableReservationRepository.js'
import { reserveNextTableTabNumber } from './tableRepository.js'
import { loadTableTabById } from './orderWriteEffects.js'
import { clearSettingsAssertions, prepareSettingsAssertion } from './settingsTransactions.js'

const domainError = (status, code, message) => Object.assign(new Error(message), { status, code })

const loadOpenTableTabForTable = (db, businessId, tableId) => db.prepare(`SELECT id
  FROM table_tabs
  WHERE business_id = ? AND table_id = ? AND status = 'open'
  LIMIT 1`).bind(businessId, tableId).first()

const loadTable = (db, businessId, tableId) => db.prepare(`SELECT id, name, is_active
  FROM tables
  WHERE id = ? AND business_id = ?
  LIMIT 1`).bind(tableId, businessId).first()

const loadConvertedResult = async (db, businessId, reservation) => {
  if (!reservation?.convertedTableTabId) return null
  const [tableTab, order] = await Promise.all([
    loadTableTabById(db, businessId, reservation.convertedTableTabId),
    loadOrderById(db, businessId, reservation.orderId),
  ])
  if (!tableTab || !order) return null
  return { reservation, order, tableTab }
}

const validateInput = (input) => {
  if (!Number.isInteger(input?.expectedRevision) || input.expectedRevision < 1) {
    throw domainError(400, 'TABLE_RESERVATION_REVISION_REQUIRED', 'Atualize a reserva e tente novamente.')
  }
  const mutationId = typeof input?.mutationId === 'string' ? input.mutationId.trim() : ''
  if (!mutationId || mutationId.length > 120) {
    throw domainError(400, 'TABLE_RESERVATION_MUTATION_REQUIRED', 'Identifique a confirmação e tente novamente.')
  }
  return { expectedRevision: input.expectedRevision, mutationId }
}

export const confirmTableReservationArrival = async (
  db,
  businessId,
  reservationId,
  input = {},
  now = new Date(),
) => {
  const { expectedRevision } = validateInput(input)
  const reservation = await loadTableReservationById(db, businessId, reservationId)
  if (!reservation) throw domainError(404, 'TABLE_RESERVATION_NOT_FOUND', 'Reserva não encontrada.')

  if (reservation.status === 'converted') {
    const replay = await loadConvertedResult(db, businessId, reservation)
    if (replay) return replay
    throw domainError(409, 'TABLE_RESERVATION_ALREADY_CLOSED', 'Esta reserva já foi encerrada.')
  }
  if (reservation.status !== 'reserved') {
    throw domainError(409, 'TABLE_RESERVATION_ALREADY_CLOSED', 'Esta reserva já foi encerrada.')
  }
  if (reservation.revision !== expectedRevision) {
    throw domainError(409, 'TABLE_RESERVATION_CHANGED', 'A reserva foi alterada. Atualize os dados e tente novamente.')
  }

  const scheduledDate = getBusinessDate(new Date(reservation.scheduledFor))
  const today = getBusinessDate(now)
  if (today < scheduledDate) {
    throw domainError(409, 'TABLE_RESERVATION_CONFIRM_TOO_EARLY', 'A chegada só pode ser confirmada no dia da reserva.')
  }

  const [order, table, openTab] = await Promise.all([
    loadOrderById(db, businessId, reservation.orderId),
    loadTable(db, businessId, reservation.tableId),
    loadOpenTableTabForTable(db, businessId, reservation.tableId),
  ])
  if (!order) throw domainError(404, 'ORDER_NOT_FOUND', 'Pedido da reserva não encontrado.')
  if (order.status === 'Cancelado') {
    throw domainError(409, 'ORDER_CANCELLED', 'Pedido cancelado não pode ser convertido em comanda.')
  }
  if (!['Em preparo', 'Finalizado'].includes(order.status)) {
    throw domainError(409, 'TABLE_RESERVATION_ALREADY_CLOSED', 'O pedido da reserva não pode mais ser convertido.')
  }
  if (!table) throw domainError(404, 'TABLE_NOT_FOUND', 'Mesa não encontrada.')
  if (!table.is_active) throw domainError(409, 'TABLE_INACTIVE', 'A mesa está inativa.')
  if (openTab) throw domainError(409, 'TABLE_OCCUPIED', 'A mesa está ocupada. Aguarde a liberação ou edite a reserva para outra mesa.')

  const tabNumber = await reserveNextTableTabNumber(db, businessId, now)
  const tableTabId = crypto.randomUUID()
  const at = now.toISOString()
  const txId = crypto.randomUUID()

  const reservationGuard = prepareSettingsAssertion(
    db,
    txId,
    'reservation',
    "EXISTS (SELECT 1 FROM table_reservations WHERE id = ? AND business_id = ? AND status = 'reserved' AND revision = ?)",
    [reservation.id, businessId, expectedRevision],
  )
  const tableGuard = prepareSettingsAssertion(
    db,
    txId,
    'table',
    `EXISTS (SELECT 1 FROM tables WHERE id = ? AND business_id = ? AND is_active = 1)
      AND NOT EXISTS (SELECT 1 FROM table_tabs WHERE business_id = ? AND table_id = ? AND status = 'open')`,
    [reservation.tableId, businessId, businessId, reservation.tableId],
  )
  const orderGuard = prepareSettingsAssertion(
    db,
    txId,
    'order',
    "EXISTS (SELECT 1 FROM orders WHERE id = ? AND business_id = ? AND table_tab_id IS NULL AND status IN ('Em preparo', 'Finalizado'))",
    [reservation.orderId, businessId],
  )
  const insertTab = db.prepare(`INSERT INTO table_tabs (
    id, business_id, table_id, table_identifier, tab_number, status,
    opened_at, closed_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, 'open', ?, NULL, ?, ?)`).bind(
    tableTabId,
    businessId,
    reservation.tableId,
    table.name,
    tabNumber,
    at,
    at,
    at,
  )
  const linkOrder = db.prepare(`UPDATE orders
    SET table_tab_id = ?
    WHERE id = ? AND business_id = ? AND table_tab_id IS NULL
      AND status IN ('Em preparo', 'Finalizado')`).bind(
    tableTabId,
    reservation.orderId,
    businessId,
  )
  const convertReservation = db.prepare(`UPDATE table_reservations
    SET status = 'converted',
      converted_table_tab_id = ?,
      converted_at = ?,
      updated_at = ?,
      revision = revision + 1
    WHERE id = ? AND business_id = ? AND status = 'reserved' AND revision = ?`).bind(
    tableTabId,
    at,
    at,
    reservation.id,
    businessId,
    expectedRevision,
  )

  try {
    await db.batch([
      reservationGuard,
      tableGuard,
      orderGuard,
      insertTab,
      linkOrder,
      convertReservation,
      clearSettingsAssertions(db, txId),businessEvent(db,businessId,{action:'reservation.arrived',resourceType:'order',resourceId:reservation.orderId,now}),
    ])
  } catch (error) {
    const refreshedReservation = await loadTableReservationById(db, businessId, reservationId)
    if (refreshedReservation?.status === 'converted') {
      const replay = await loadConvertedResult(db, businessId, refreshedReservation)
      if (replay) return replay
    }
    if (!refreshedReservation) throw domainError(404, 'TABLE_RESERVATION_NOT_FOUND', 'Reserva não encontrada.')
    if (refreshedReservation.status !== 'reserved') {
      throw domainError(409, 'TABLE_RESERVATION_ALREADY_CLOSED', 'Esta reserva já foi encerrada.')
    }
    if (refreshedReservation.revision !== expectedRevision) {
      throw domainError(409, 'TABLE_RESERVATION_CHANGED', 'A reserva foi alterada. Atualize os dados e tente novamente.')
    }

    const [currentTable, currentOpenTab, currentOrder] = await Promise.all([
      loadTable(db, businessId, refreshedReservation.tableId),
      loadOpenTableTabForTable(db, businessId, refreshedReservation.tableId),
      loadOrderById(db, businessId, refreshedReservation.orderId),
    ])
    if (!currentTable) throw domainError(404, 'TABLE_NOT_FOUND', 'Mesa não encontrada.')
    if (!currentTable.is_active) throw domainError(409, 'TABLE_INACTIVE', 'A mesa está inativa.')
    if (currentOpenTab) {
      throw domainError(409, 'TABLE_OCCUPIED', 'A mesa está ocupada. Aguarde a liberação ou edite a reserva para outra mesa.')
    }
    if (currentOrder?.status === 'Cancelado') {
      throw domainError(409, 'ORDER_CANCELLED', 'Pedido cancelado não pode ser convertido em comanda.')
    }
    if (currentOrder?.tableTabId) {
      throw domainError(409, 'TABLE_RESERVATION_CHANGED', 'A reserva foi alterada. Atualize os dados e tente novamente.')
    }
    throw error
  }

  const convertedReservation = await loadTableReservationById(db, businessId, reservationId)
  const result = await loadConvertedResult(db, businessId, convertedReservation)
  if (!result) throw domainError(500, 'TABLE_RESERVATION_CONVERSION_FAILED', 'Não foi possível abrir a comanda da reserva.')
  return result
}
