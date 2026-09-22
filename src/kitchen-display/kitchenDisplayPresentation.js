import { buildKitchenQueueModel } from '../domains/orders/index.js'

export const KITCHEN_TV_NEAR_LIMIT_MINUTES = 5

const toIdSet = (value) => value instanceof Set ? value : new Set(value || [])

const presentationState = (entry, now, highlightedIds) => {
  if (highlightedIds.has(String(entry.order.id))) return 'new'
  if (entry.timingState === 'late' || entry.timingState === 'very-late') return 'late'
  const millisecondsToLimit = entry.lateAt instanceof Date ? entry.lateAt.getTime() - now.getTime() : Number.POSITIVE_INFINITY
  if (entry.phase === 'preparing' && entry.timingState === 'on-time' && millisecondsToLimit <= KITCHEN_TV_NEAR_LIMIT_MINUTES * 60_000) return 'near-limit'
  return entry.phase === 'scheduled' ? 'scheduled' : 'preparing'
}

export function buildKitchenDisplayPresentation(orders = [], timing, now = new Date(), highlightedIds = new Set()) {
  const queue = buildKitchenQueueModel(orders, now, '', timing)
  const preparingLimit = queue.scheduled.length ? 5 : 6
  const preparing = queue.preparing.slice(0, preparingLimit)
  const scheduled = queue.scheduled.slice(0, 6 - preparing.length)
  const highlighted = toIdSet(highlightedIds)
  const visible = [...preparing, ...scheduled]

  return {
    cards: visible.map((entry) => ({ ...entry, state: presentationState(entry, now, highlighted) })),
    counts: { preparing: queue.counts.preparing, late: queue.counts.late, scheduled: queue.counts.scheduled },
    overflow: Math.max(0, queue.totalVisible - visible.length),
  }
}
