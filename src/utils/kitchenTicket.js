import { FINANCE_TIME_ZONE } from '../../shared/finance.js'
import { getOperationalStartAt, getScheduledLateAt } from '../../shared/orderTiming.js'
import { getOrderItemDisplayName, getOrderItems } from './orderCart.js'
import { getElapsedMinutes } from './orderWorkflow.js'

const itemKey = (item, index) => item.id || item.lineId || `${item.productId || item.name || 'item'}-${index}`
const formatTime = (value) => new Intl.DateTimeFormat('pt-BR', {
  timeZone: FINANCE_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}).format(new Date(value))
const elapsedLabel = (minutes) => {
  const totalMinutes = Math.max(0, Math.floor(Number(minutes) || 0))
  if (totalMinutes < 60) return `${totalMinutes} min`

  const hours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60
  return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`
}
const normalizeKitchenItemNote = (value) => String(value ?? '').trim().replace(/\s+/g, ' ')

export const buildKitchenItemSummary = (order, limit = 3) => {
  const items = getOrderItems(order)
  const labels = items.slice(0, Math.max(0, limit)).map(getOrderItemDisplayName)
  const remaining = items.length - labels.length
  const tail = remaining > 0 ? ` +${remaining}` : ''
  return `${items.length} ${items.length === 1 ? 'item' : 'itens'} · ${labels.join(', ')}${tail}`
}

export const getKitchenItemNotes = (order) => getOrderItems(order)
  .map((item, index) => ({ item, index, note: normalizeKitchenItemNote(item.note) }))
  .filter(({ note }) => Boolean(note))
  .map(({ item, index, note }) => {
    const itemLabel = getOrderItemDisplayName(item)
    return { key: itemKey(item, index), itemLabel, note, text: `${itemLabel} — ${note}` }
  })

export const buildKitchenTimingCopy = (entry, now = new Date()) => {
  const order = entry?.order || {}
  const desiredCopy = order.scheduledFor ? `Desejado ${formatTime(order.scheduledFor)}` : ''
  if (entry?.phase === 'scheduled') {
    const start = getOperationalStartAt(order)
    const minutes = start ? Math.max(0, Math.floor((start.getTime() - new Date(now).getTime()) / 60_000)) : 0
    return { primary: `Preparo em ${elapsedLabel(minutes)}`, secondary: desiredCopy }
  }

  if (entry?.timingState && entry.timingState !== 'on-time') {
    const lateAt = order.scheduledFor ? getScheduledLateAt(order) : null
    const threshold = entry.timingState === 'very-late' ? 40 : 30
    const elapsed = lateAt
      ? Math.max(0, Math.floor((new Date(now).getTime() - lateAt.getTime()) / 60_000))
      : Math.max(0, getElapsedMinutes(order, now) - threshold)
    return { primary: `Fora do prazo há ${elapsedLabel(elapsed)}`, secondary: desiredCopy }
  }

  return { primary: `Em preparo há ${elapsedLabel(getElapsedMinutes(order, now))}`, secondary: desiredCopy }
}
