import { apiError, json } from './http.js'
import { loadAutomaticPrintJobForOrder } from './orderPrintingRepository.js'
import { loadOrderById } from './repositories.js'
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
  requireReservationRead(context)

  if (url.pathname === '/api/table-reservations' && request.method === 'GET') {
    const reservations = await listTableReservations(env.DB, context.businessId, parseFilters(url.searchParams))
    return json({ reservations })
  }

  const detailMatch = /^\/api\/table-reservations\/([^/]+)$/.exec(url.pathname)
  if (detailMatch && request.method === 'GET') {
    const reservation = await loadTableReservationById(env.DB, context.businessId, decodeURIComponent(detailMatch[1]))
    if (!reservation) throw apiError(404, 'TABLE_RESERVATION_NOT_FOUND', 'Reserva não encontrada.')
    const [order, printJob] = await Promise.all([
      loadOrderById(env.DB, context.businessId, reservation.orderId),
      loadAutomaticPrintJobForOrder(env.DB, context.businessId, reservation.orderId),
    ])
    if (!order) throw apiError(404, 'TABLE_RESERVATION_NOT_FOUND', 'Reserva não encontrada.')
    return json({ reservation, order, printJob })
  }

  return null
}
