import { FINANCE_TIME_ZONE, getBusinessDate } from '../../../../shared/finance.js'
import { formatOrderDisplayNumber } from '../../../../shared/orderDisplayNumber.js'
import { getOrderItemsSearchText } from './orderCart.js'
import { isOrderFinished } from './orderLifecycle.js'

export const historyTimestamp = order => (order.status === 'Cancelado' ? order.cancelledAt : order.finishedAt) || order.createdAt
const dateKey = value => { const date = new Date(value); return value && Number.isFinite(date.getTime()) ? getBusinessDate(date) : null }
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
const shiftDate = (value, days) => { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }
const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
export const formatHistoryTime = value => {
  const date = new Date(value)
  return value && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('pt-BR', { timeZone: FINANCE_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date) : '—'
}
export const historyDayLabel = (value, now = new Date()) => {
  if (!value) return 'Data não informada'
  const today = getBusinessDate(now)
  const prefix = value === today ? 'Hoje · ' : value === shiftDate(today, -1) ? 'Ontem · ' : ''
  return prefix + new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: FINANCE_TIME_ZONE }).format(new Date(`${value}T12:00:00Z`))
}
export const getHistoryView = (orders, query = {}, now = new Date()) => {
  const today = getBusinessDate(now)
  const period = query.period || 'all'
  const end = period === 'yesterday' ? shiftDate(today, -1) : period === 'custom' ? query.endDate : today
  const start = period === 'custom' ? query.startDate : period === '7d' ? shiftDate(today, -6) : end
  const validRange = period !== 'custom' || (validDate(start) && validDate(end) && start <= end)
  const search = normalized(query.search)
  const eligible = (orders || []).filter(isOrderFinished).filter(order => {
    const day = dateKey(historyTimestamp(order))
    if (!validRange || (period !== 'all' && (!day || day < start || day > end))) return false
    return normalized(`${order.client} ${formatOrderDisplayNumber(order)} ${order.type} ${getOrderItemsSearchText(order)}`).includes(search)
  })
  const counts = { all: eligible.length, finalized: eligible.filter(o => o.status === 'Finalizado').length, cancelled: eligible.filter(o => o.status === 'Cancelado').length }
  const visible = eligible.filter(o => !query.filter || query.filter === 'all' || (query.filter === 'finalized' ? o.status === 'Finalizado' : o.status === 'Cancelado'))
    .sort((a, b) => (Date.parse(historyTimestamp(b)) || 0) - (Date.parse(historyTimestamp(a)) || 0))
  const groups = []
  for (const order of visible) {
    const date = dateKey(historyTimestamp(order))
    let group = groups.find(g => g.date === date)
    if (!group) { group = { date, label: historyDayLabel(date, now), orders: [] }; groups.push(group) }
    group.orders.push(order)
  }
  return { orders: visible, counts, groups, validRange }
}
