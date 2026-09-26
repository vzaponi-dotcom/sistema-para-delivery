import { shiftCalendarDate } from './businessDate.js'

const monthBefore = (date) => {
  const [year, month] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7)
}

const monthEnd = (month) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10)

export function previousReportingPeriod({ from, to, period = 'custom' }) {
  if (period === 'current-month') {
    const prior = monthBefore(from)
    const day = Math.min(Number(to.slice(-2)), Number(monthEnd(prior).slice(-2)))
    return { from: `${prior}-01`, to: `${prior}-${String(day).padStart(2, '0')}` }
  }
  if (period === 'previous-month') {
    const prior = monthBefore(from)
    return { from: `${prior}-01`, to: monthEnd(prior) }
  }
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
  return { from: shiftCalendarDate(from, -days), to: shiftCalendarDate(from, -1) }
}

const DIRECTION = Object.freeze({
  salesCents: 'higher_better', ordersCount: 'higher_better', averageTicketCents: 'higher_better',
  receivedCents: 'higher_better', receivableCents: 'lower_better', receivableCount: 'lower_better',
  cancellationRate: 'lower_better', refundsCents: 'lower_better', withinDeadlineRate: 'higher_better',
  operationalOrdersCount: 'neutral', averageDurationMinutes: 'lower_better', medianDurationMinutes: 'lower_better',
  p90DurationMinutes: 'lower_better', fastestMinutes: 'lower_better', slowestMinutes: 'lower_better',
  withinDeadlineCount: 'higher_better', outsideDeadlineCount: 'lower_better', averageLateMinutes: 'lower_better',
  scheduledPunctualityRate: 'higher_better', unitsSold: 'higher_better', mealsSold: 'higher_better',
  merchandiseRevenueCents: 'higher_better', discountCents: 'neutral', surchargeCents: 'neutral',
  deliveryFeesCents: 'neutral', cancellationCount: 'lower_better',
})

export function compareMetricValues(current, previous, direction = 'neutral') {
  const hasValues = Number.isFinite(current) && Number.isFinite(previous)
  const hasDenominator = hasValues && previous !== 0
  const delta = hasValues ? Number((current - previous).toFixed(2)) : null
  return {
    current, previous, delta,
    percent: hasDenominator ? Number(((delta / Math.abs(previous)) * 100).toFixed(2)) : null,
    available: hasDenominator,
    direction,
  }
}

export function compareMetrics(current, previous) {
  const metrics = Object.fromEntries(Object.entries(current).map(([key, value]) => [
    key, compareMetricValues(value, previous[key], DIRECTION[key] || 'neutral'),
  ]))
  return { available: Object.values(metrics).some((metric) => metric.available), metrics }
}
