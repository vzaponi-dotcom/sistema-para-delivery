import { getOperationalStartAt, getOrderLateAt, isScheduledWaiting } from '../../../../shared/orderTiming.js'
import { formatOrderDisplayNumber } from '../../../../shared/orderDisplayNumber.js'
import { getBusinessDate } from '../../../../shared/finance.js'
import { getOrderItemsSearchText } from './orderCartRead.js'
import { isOrderActive } from './orderLifecycle.js'
import { getOrderTimingState, isFinishedToday } from './orderWorkflow.js'

const normalizeSearch = (value) => String(value ?? '').trim().toLocaleLowerCase('pt-BR')
const compareIds = (first, second) => String(first.order.id).localeCompare(String(second.order.id), 'pt-BR')
const getTimestamp = (value) => value instanceof Date && !Number.isNaN(value.getTime()) ? value.getTime() : Number.POSITIVE_INFINITY

const compareDeadlinePriority = (first, second) => getTimestamp(first.lateAt) - getTimestamp(second.lateAt)
  || getTimestamp(first.operationalStartAt) - getTimestamp(second.operationalStartAt)
  || compareIds(first, second)
const compareScheduledFor = (first, second) => getTimestamp(new Date(first.order.scheduledFor)) - getTimestamp(new Date(second.order.scheduledFor)) || compareIds(first, second)

const matchesKitchenSearch = (order, normalizedSearch) => {
  const orderNumber = Number(order?.orderNumber)
  return !normalizedSearch || [
    order.client,
    order.id,
    formatOrderDisplayNumber(order),
    Number.isInteger(orderNumber) && orderNumber > 0 ? `Pedido ${orderNumber}` : '',
    getOrderItemsSearchText(order),
    order.type,
  ].join(' ').toLocaleLowerCase('pt-BR').includes(normalizedSearch)
}

const buildActiveEntry = (order, now, currentTiming) => {
  const phase = isScheduledWaiting(order, now, currentTiming) ? 'scheduled' : 'preparing'
  const timingState = getOrderTimingState(order, now, currentTiming)
  return {
    order,
    phase,
    operationalStartAt: getOperationalStartAt(order, currentTiming),
    lateAt: getOrderLateAt(order, currentTiming),
    timingState,
    isLate: timingState !== 'on-time',
  }
}

const isFutureWaitingEntry = (entry, currentBusinessDate) => {
  if (entry.phase !== 'scheduled' || !entry.order?.scheduledFor || !currentBusinessDate) return false
  const scheduledFor = new Date(entry.order.scheduledFor)
  if (Number.isNaN(scheduledFor.getTime())) return false
  return getBusinessDate(scheduledFor) > currentBusinessDate
}

const buildQueueEntries = (orders, now, currentTiming) => {
  const reference = now instanceof Date ? now : new Date(now)
  const currentBusinessDate = Number.isNaN(reference.getTime()) ? null : getBusinessDate(reference)
  const entries = orders.filter(isOrderActive).map((order) => buildActiveEntry(order, reference, currentTiming))
  return { reference, currentBusinessDate, entries }
}

export const buildFutureScheduledOrdersModel = (orders = [], now = new Date(), search = '', currentTiming) => {
  const normalizedSearch = normalizeSearch(search)
  const { currentBusinessDate, entries } = buildQueueEntries(orders, now, currentTiming)
  const all = entries.filter((entry) => isFutureWaitingEntry(entry, currentBusinessDate)).sort(compareScheduledFor)
  const visible = all.filter(({ order }) => matchesKitchenSearch(order, normalizedSearch))

  return {
    all,
    visible,
    totalCount: all.length,
    visibleCount: visible.length,
  }
}

export const buildKitchenQueueModel = (orders = [], now = new Date(), search = '', currentTiming) => {
  const normalizedSearch = normalizeSearch(search)
  const { reference, currentBusinessDate, entries } = buildQueueEntries(orders, now, currentTiming)
  const allActive = entries.filter((entry) => !isFutureWaitingEntry(entry, currentBusinessDate))
  const visible = allActive.filter(({ order }) => matchesKitchenSearch(order, normalizedSearch))
  const preparing = visible.filter(({ phase }) => phase === 'preparing').sort(compareDeadlinePriority)
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
      finishedToday: orders.filter((order) => order.status === 'Finalizado' && isFinishedToday(order, reference)).length,
    },
  }
}
