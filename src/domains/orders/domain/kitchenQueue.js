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

export const buildKitchenQueueModel = (orders = [], now = new Date(), search = '', currentTiming) => {
  const normalizedSearch = normalizeSearch(search)
  const reference = now instanceof Date ? now : new Date(now)
  const currentBusinessDate = Number.isNaN(reference.getTime()) ? null : getBusinessDate(reference)
  const mappedActive = orders.filter(isOrderActive).map((order) => {
    const phase = isScheduledWaiting(order, reference, currentTiming) ? 'scheduled' : 'preparing'
    const timingState = getOrderTimingState(order, reference, currentTiming)
    return {
      order,
      phase,
      operationalStartAt: getOperationalStartAt(order, currentTiming),
      lateAt: getOrderLateAt(order, currentTiming),
      timingState,
      isLate: timingState !== 'on-time',
    }
  })
  const isFutureWaiting = ({ order, phase }) => {
    if (phase !== 'scheduled' || !order?.scheduledFor || !currentBusinessDate) return false
    const scheduledFor = new Date(order.scheduledFor)
    if (Number.isNaN(scheduledFor.getTime())) return false
    return getBusinessDate(scheduledFor) > currentBusinessDate
  }
  const futureAll = mappedActive.filter(isFutureWaiting)
  const allActive = mappedActive.filter((entry) => !isFutureWaiting(entry))
  const visible = allActive.filter(({ order }) => matchesKitchenSearch(order, normalizedSearch))
  const futureScheduled = futureAll
    .filter(({ order }) => matchesKitchenSearch(order, normalizedSearch))
    .sort(compareScheduledFor)
  const preparing = visible.filter(({ phase }) => phase === 'preparing').sort(compareDeadlinePriority)
  const scheduled = visible.filter(({ phase }) => phase === 'scheduled').sort(compareScheduledFor)

  return {
    allActive,
    preparing,
    scheduled,
    futureScheduled,
    futureScheduledCount: futureAll.length,
    totalVisible: visible.length,
    counts: {
      preparing: allActive.filter(({ phase }) => phase === 'preparing').length,
      scheduled: allActive.filter(({ phase }) => phase === 'scheduled').length,
      late: allActive.filter(({ isLate }) => isLate).length,
      finishedToday: orders.filter((order) => order.status === 'Finalizado' && isFinishedToday(order, reference)).length,
    },
  }
}
