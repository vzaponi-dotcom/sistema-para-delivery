import { getBusinessDate } from '../../shared/finance.js'
import {
  getOperationalStartAt, getOrderLateAt, getOrderMinutesLate,
  getOperationalDurationMinutes, getScheduledLateAt, selectOrderTimingPolicy,
} from '../../shared/orderTiming.js'

const TERMINAL = new Set(['Finalizado', 'Entregue', 'Despachado'])
const HOUR = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' })
const round = (value) => Number(value.toFixed(2))
const average = (values) => values.length ? round(values.reduce((total, value) => total + value, 0) / values.length) : null
const rate = (part, whole) => whole ? round(part * 100 / whole) : null

export function calculateOperation(rows, query = {}) {
  const eligible = rows.filter((row) => TERMINAL.has(row.status) && !row.is_backdated)
  const measured = []
  let legacyPolicyCount = 0
  for (const row of eligible) {
    const order = {
      ...row, createdAt: row.created_at, finishedAt: row.finished_at,
      scheduledFor: row.scheduled_for, timingPolicySnapshot: row.timing_policy_snapshot_json,
    }
    // A malformed historical snapshot must fail explicitly, never silently use LEGACY_TIMING.
    selectOrderTimingPolicy(order)
    const start = getOperationalStartAt(order)
    const duration = getOperationalDurationMinutes(order)
    const lateAt = getOrderLateAt(order)
    if (!start || duration === null || !lateAt) continue
    const finish = new Date(order.finishedAt)
    const onTime = finish <= lateAt
    if (order.timingPolicySnapshot == null) legacyPolicyCount += 1
    measured.push({
      id: row.id, type: row.type, scheduled: Boolean(order.scheduledFor), duration, onTime,
      minutesLate: getOrderMinutesLate(order, finish),
      hour: Number(HOUR.format(start)),
      weekday: new Date(`${getBusinessDate(start)}T00:00:00Z`).getUTCDay(),
      scheduledOnTime: order.scheduledFor ? finish <= getScheduledLateAt(order) : null,
    })
  }
  const hourFiltered = measured.filter((row) => (query.orderHourFrom == null || row.hour >= query.orderHourFrom)
    && (query.orderHourTo == null || row.hour <= query.orderHourTo))
  const selected = query.operationalDeadline === 'on-time' ? hourFiltered.filter((row) => row.onTime)
    : query.operationalDeadline === 'late' ? hourFiltered.filter((row) => !row.onTime) : hourFiltered
  const durations = selected.map((row) => row.duration).sort((a, b) => a - b)
  const median = durations.length ? (durations.length % 2
    ? durations[(durations.length - 1) / 2]
    : (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2) : null
  const onTimeCount = selected.filter((row) => row.onTime).length
  const late = selected.filter((row) => !row.onTime)
  const scheduled = selected.filter((row) => row.scheduled)
  const group = (keys, keyOf) => keys.map((key) => {
    const values = selected.filter((row) => keyOf(row) === key)
    return { [keyOf === byHour ? 'hour' : keyOf === byWeekday ? 'weekday' : 'type']: key, count: values.length, averageDurationMinutes: average(values.map((row) => row.duration)) }
  })
  const byHour = (row) => row.hour
  const byWeekday = (row) => row.weekday
  const byType = (row) => row.type
  const bands = [
    { label: 'Até 15 min', min: 0, max: 15 },
    { label: '16–30 min', min: 16, max: 30 },
    { label: '31–45 min', min: 31, max: 45 },
    { label: '46–60 min', min: 46, max: 60 },
    { label: '61–90 min', min: 61, max: 90 },
    { label: 'Mais de 90 min', min: 91, max: Infinity },
  ]
  const quality = {
    eligibleCount: eligible.length, measuredCount: measured.length,
    legacyPolicyCount, invalidCount: eligible.length - measured.length,
  }
  return {
    data: {
      operationalOrdersCount: selected.length,
      averageDurationMinutes: average(durations), medianDurationMinutes: median,
      p90DurationMinutes: durations.length ? durations[Math.ceil(durations.length * 0.9) - 1] : null,
      fastestMinutes: durations[0] ?? null, slowestMinutes: durations.at(-1) ?? null,
      withinDeadlineCount: onTimeCount, outsideDeadlineCount: late.length,
      withinDeadlineRate: rate(onTimeCount, selected.length),
      averageLateMinutes: average(late.map((row) => row.minutesLate)),
      scheduledPunctualityRate: rate(scheduled.filter((row) => row.scheduledOnTime).length, scheduled.length),
      byHour: group(Array.from({ length: 24 }, (_, index) => index), byHour),
      byWeekday: group(Array.from({ length: 7 }, (_, index) => index), byWeekday),
      byModality: group(['Entrega', 'Retirada', 'Local'], byType),
      bySchedule: [
        { schedule: 'immediate', count: selected.filter((row) => !row.scheduled).length },
        { schedule: 'scheduled', count: scheduled.length },
      ],
      durationBands: bands.map(({ label, min, max }) => ({ label, count: durations.filter((value) => value >= min && value <= max).length })),
    },
    quality,
    warnings: quality.invalidCount > 0 ? ['Cobertura operacional parcial: alguns pedidos possuem timestamps inválidos ou ausentes.'] : [],
  }
}
