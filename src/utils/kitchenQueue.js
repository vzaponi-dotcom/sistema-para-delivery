import { getOperationalStartAt, isScheduledWaiting } from '../../shared/orderTiming.js'
import { getOrderItemsSearchText } from './orderCart.js'
import { isOrderActive } from './orderLifecycle.js'
import { getOrderTimingState, isFinishedToday } from './orderWorkflow.js'

const normalizeSearch = (value) => String(value ?? '').trim().toLocaleLowerCase('pt-BR')
const compareIds = (first, second) => String(first.order.id).localeCompare(String(second.order.id), 'pt-BR')
const getTimestamp = (value) => value instanceof Date && !Number.isNaN(value.getTime()) ? value.getTime() : Number.POSITIVE_INFINITY

const compareOperationalStart = (first, second) => getTimestamp(first.operationalStartAt) - getTimestamp(second.operationalStartAt) || compareIds(first, second)
const compareScheduledFor = (first, second) => getTimestamp(new Date(first.order.scheduledFor)) - getTimestamp(new Date(second.order.scheduledFor)) || compareIds(first, second)

const matchesKitchenSearch = (order, normalizedSearch) => !normalizedSearch || [
  order.client,
  order.id,
  String(order.id ?? '').slice(-4),
  getOrderItemsSearchText(order),
  order.type,
].join(' ').toLocaleLowerCase('pt-BR').includes(normalizedSearch)

export const buildKitchenQueueModel = (orders = [], now = new Date(), search = '') => {
  const normalizedSearch = normalizeSearch(search)
  const allActive = orders.filter(isOrderActive).map((order) => {
    const phase = isScheduledWaiting(order, now) ? 'scheduled' : 'preparing'
    const timingState = getOrderTimingState(order, now)
    return { order, phase, operationalStartAt: getOperationalStartAt(order), timingState, isLate: timingState !== 'on-time' }
  })
  const visible = allActive.filter(({ order }) => matchesKitchenSearch(order, normalizedSearch))
  const preparing = visible.filter(({ phase }) => phase === 'preparing').sort(compareOperationalStart)
  const scheduled = visible.filter(({ phase }) => phase === 'scheduled').sort(compareScheduledFor)

  return {
    allActive,
    preparing,
    scheduled,
    totalVisible: visible.length,
    counts: {
      preparing: allActive.filter(({ phase }) => phase === 'preparing').length,
      scheduled: allActive.filter(({ phase }) => phase === 'scheduled').length,
      late: allActive.filter(({ isLate }) => isLate).length,
      finishedToday: orders.filter((order) => order.status === 'Finalizado' && isFinishedToday(order, now)).length,
    },
  }
}
