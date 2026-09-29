import { apiError, assertSameOriginMutation, json, readJson } from './http.js'
import { loadAutomaticPrintJobForOrder } from './orderPrintingRepository.js'
import { loadOrderById } from './repositories.js'
import { cancelOrder } from './orderCancellation.js'
import { listTables } from './tableRepository.js'
import { requireCapability } from './settingsAccess.js'
import { confirmTableReservationArrival } from './tableReservationArrival.js'
import { validateCheckoutInput } from './orderCheckout.js'
import { updateTableReservation } from './tableReservationUpdate.js'
import {
  listTableReservations,
  loadTableReservationById,
} from './tableReservationRepository.js'

const RESERVATION_STATUSES = new Set(['reserved', 'converted', 'cancelled', 'no_show'])
const FILTER_KEYS = new Set(['status', 'from', 'to', 'tableId'])

const requireReservationRead = (context) => {
  const granted = context?.granted
  if (granted?.has('orders.view') || granted?.has('comandas.view')) return
  throw apiError(403, 'FORBIDDEN', 'Você não pode acessar as reservas.')
}

const invalidFilter = (message = 'Filtros de reserva inválidos.') => {
  throw apiError(400, 'TABLE_RESERVATION_FILTER_INVALID', message)
}

const normalizeIso = (value, field) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) invalidFilter(`${field} deve ser uma data/hora válida.`)
  return date.toISOString()
}

const parseFilters = (searchParams) => {
  for (const key of searchParams.keys()) if (!FILTER_KEYS.has(key)) invalidFilter('Filtro de reserva não reconhecido.')
  const status = searchParams.get('status') || ''
  if (status && !RESERVATION_STATUSES.has(status)) invalidFilter('Status de reserva inválido.')
  const tableId = (searchParams.get('tableId') || '').trim()
  if (tableId.length > 120) invalidFilter('Mesa inválida.')
  const from = normalizeIso(searchParams.get('from'), 'from')
  const to = normalizeIso(searchParams.get('to'), 'to')
  if (from && to && from >= to) invalidFilter('O início do período deve ser anterior ao fim.')
  return {
    ...(status ? { status } : {}),
    ...(tableId ? { tableId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  }
}

export const handleTableReservationApi = async (request, env, context, url = new URL(request.url)) => {
  if (!url.pathname.startsWith('/api/table-reservations')) return null

  if (url.pathname === '/api/table-reservations' && request.method === 'GET') {
    requireReservationRead(context)
    const reservations = await listTableReservations(env.DB, context.businessId, parseFilters(url.searchParams))
    return json({ reservations })
  }

  const detailMatch = /^\/api\/table-reservations\/([^/]+)$/.exec(url.pathname)
  if (detailMatch && request.method === 'GET') {
    requireReservationRead(context)
    const reservation = await loadTableReservationById(env.DB, context.businessId, decodeURIComponent(detailMatch[1]))
    if (!reservation) throw apiError(404, 'TABLE_RESERVATION_NOT_FOUND', 'Reserva não encontrada.')
    const [order, printJob] = await Promise.all([
      loadOrderById(env.DB, context.businessId, reservation.orderId),
      loadAutomaticPrintJobForOrder(env.DB, context.businessId, reservation.orderId),
    ])
    if (!order) throw apiError(404, 'TABLE_RESERVATION_NOT_FOUND', 'Reserva não encontrada.')
    return json({ reservation, order, printJob })
  }

  if (detailMatch && request.method === 'PUT') {
    requireCapability(context, 'orders.create')
    assertSameOriginMutation(request)
    const body = await readJson(request)
    if (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 1) {
      throw apiError(400, 'TABLE_RESERVATION_REVISION_REQUIRED', 'Atualize a reserva e tente novamente.')
    }
    const now = env.now instanceof Date ? env.now : new Date()
    const validated = validateCheckoutInput(
      body,
      `reservation-edit:${decodeURIComponent(detailMatch[1])}:${body.expectedRevision}`,
      now,
    )
    if (validated.type !== 'Local' || validated.customerIdentity.type !== 'table' || !validated.scheduledFor) {
      throw apiError(400, 'TABLE_RESERVATION_UPDATE_INVALID', 'A edição da reserva precisa manter um pedido Local agendado.')
    }
    if (validated.adjustment.type !== 'none') requireCapability(context, 'orders.discount')
    const result = await updateTableReservation(
      env.DB,
      context.businessId,
      decodeURIComponent(detailMatch[1]),
      { ...validated, expectedRevision: body.expectedRevision },
      now,
    )
    return json({
      ...result,
      tables: await listTables(env.DB, context.businessId),
    })
  }

  const arrivalMatch = /^\/api\/table-reservations\/([^/]+)\/confirm-arrival$/.exec(url.pathname)
  if (arrivalMatch && request.method === 'POST') {
    requireCapability(context, 'orders.create')
    assertSameOriginMutation(request)
    const body = await readJson(request)
    if (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 1) {
      throw apiError(400, 'TABLE_RESERVATION_REVISION_REQUIRED', 'Atualize a reserva e tente novamente.')
    }
    const mutationId = typeof body.mutationId === 'string' ? body.mutationId.trim() : ''
    if (!mutationId || mutationId.length > 120) {
      throw apiError(400, 'TABLE_RESERVATION_MUTATION_REQUIRED', 'Identifique a confirmação e tente novamente.')
    }
    const now = env.now instanceof Date ? env.now : new Date()
    const result = await confirmTableReservationArrival(
      env.DB,
      context.businessId,
      decodeURIComponent(arrivalMatch[1]),
      { expectedRevision: body.expectedRevision, mutationId },
      now,
    )
    return json({
      ...result,
      tables: await listTables(env.DB, context.businessId),
    })
  }

  const actionMatch = /^\/api\/table-reservations\/([^/]+)\/(cancel|no-show)$/.exec(url.pathname)
  if (actionMatch && request.method === 'POST') {
    requireCapability(context, 'orders.cancel')
    assertSameOriginMutation(request)
    const body = await readJson(request)
    if (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 1) {
      throw apiError(400, 'TABLE_RESERVATION_REVISION_REQUIRED', 'Atualize a reserva e tente novamente.')
    }
    const reservation = await loadTableReservationById(env.DB, context.businessId, decodeURIComponent(actionMatch[1]))
    if (!reservation) throw apiError(404, 'TABLE_RESERVATION_NOT_FOUND', 'Reserva não encontrada.')
    const cancellationInput = {
      reason: body.reason,
      note: body.note,
      refundNow: Boolean(body.refundNow),
      refundMethod: body.refundMethod,
      ...(Number.isInteger(body.cancelReasonRevision) && body.cancelReasonRevision >= 0
        ? { expectedRevision: body.cancelReasonRevision }
        : {}),
    }
    const now = env.now instanceof Date ? env.now : new Date()
    const result = await cancelOrder(
      env.DB,
      context.businessId,
      reservation.orderId,
      cancellationInput,
      now,
      {
        requireActiveReservation: true,
        expectedReservationRevision: body.expectedRevision,
        reservationDisposition: actionMatch[2] === 'no-show' ? 'no_show' : 'cancelled',
      },
    )
    const closedReservation = await loadTableReservationById(env.DB, context.businessId, reservation.id)
    return json({
      ...result,
      reservation: closedReservation,
      tables: await listTables(env.DB, context.businessId),
    })
  }

  return null
}
