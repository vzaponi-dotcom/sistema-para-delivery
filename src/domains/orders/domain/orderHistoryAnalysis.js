import { getOperationalDurationMinutes } from '../../../../shared/orderTiming.js'
import { isOrderCancelled } from './orderLifecycle.js'
import { toLocalDateValue } from './orderWorkflow.js'

const PERIOD_DAYS = { today: 1, '7d': 7, '30d': 30 }
const localNoon = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0)

export const getDashboardDateRange = (period = '30d', now = new Date()) => {
  const days = PERIOD_DAYS[period] ?? PERIOD_DAYS['30d']
  const end = localNoon(now instanceof Date ? now : new Date(now))

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end)
    date.setDate(end.getDate() - (days - 1 - index))
    return toLocalDateValue(date)
  })
}

export const filterOrdersByPeriod = (orders, period = '30d', now = new Date()) => {
  const dates = new Set(getDashboardDateRange(period, now))
  return (Array.isArray(orders) ? orders : [])
    .filter((order) => !isOrderCancelled(order))
    .filter((order) => dates.has(order?.orderDate))
}

export const calculateOperationalMetrics = (orders, period = '30d', now = new Date(), currentTiming) => {
  const eligible = filterOrdersByPeriod(orders, period, now)
    .filter((order) => order?.status === 'Finalizado' && order?.isBackdated !== true)
    .map((order) => ({ order, minutes: getOperationalDurationMinutes(order, currentTiming) }))
    .filter(({ minutes }) => Number.isFinite(minutes) && minutes >= 0)

  const durations = eligible.map(({ minutes }) => minutes)
  const sampleSize = durations.length
  const total = durations.reduce((sum, minutes) => sum + minutes, 0)
  const byType = { Entrega: 0, Retirada: 0, Local: 0 }
  const byTypeCounts = { Entrega: 0, Retirada: 0, Local: 0 }

  for (const { order, minutes } of eligible) {
    if (!(order.type in byType)) continue
    byType[order.type] += minutes
    byTypeCounts[order.type] += 1
  }

  return {
    sampleSize,
    averageMinutes: sampleSize ? total / sampleSize : 0,
    fastestMinutes: sampleSize ? Math.min(...durations) : 0,
    slowestMinutes: sampleSize ? Math.max(...durations) : 0,
    bands: [
      durations.filter((minutes) => minutes <= 20).length,
      durations.filter((minutes) => minutes >= 21 && minutes <= 30).length,
      durations.filter((minutes) => minutes >= 31 && minutes <= 40).length,
      durations.filter((minutes) => minutes > 40).length,
    ],
    byType: Object.fromEntries(Object.keys(byType).map((type) => [type, byTypeCounts[type] ? byType[type] / byTypeCounts[type] : 0])),
  }
}
