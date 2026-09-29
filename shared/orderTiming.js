import { FINANCE_TIME_ZONE, getBusinessDate } from './finance.js'
import { LEGACY_TIMING } from './businessPolicies.js'

export const SCHEDULED_PREP_LEAD_MINUTES = 50
export const SCHEDULED_LATE_GRACE_MINUTES = 15
export const IMMEDIATE_LATE_AFTER_MINUTES = 30
export const SCHEDULE_MAX_DAYS = 90
export const getScheduleMaxBusinessDate = () => ''

const SCHEDULE_TYPES = new Set(['Entrega', 'Retirada', 'Local'])
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const businessDayNumber = (value) => {
  const match = ISO_DATE_PATTERN.exec(String(value || ''))
  if (!match) return null
  const [, rawYear, rawMonth, rawDay] = match
  const year = Number(rawYear)
  const month = Number(rawMonth)
  const day = Number(rawDay)
  const timestamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(timestamp)
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null
  return Math.floor(timestamp / 86_400_000)
}

const TIMING_KEYS = Object.keys(LEGACY_TIMING)
const TERMINAL_STATUSES = new Set(['Finalizado', 'Cancelado', 'Entregue', 'Despachado'])

const invalidTimingPolicy = (code, field) => {
  throw Object.assign(new Error('Política de tempo do pedido inválida.'), { status: 503, code, field })
}

export const validateOrderTimingPolicy = (value, code = 'ORDER_TIMING_POLICY_INVALID') => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidTimingPolicy(code, 'timing')
  const keys = Object.keys(value)
  if (keys.length !== TIMING_KEYS.length || keys.some((key) => !TIMING_KEYS.includes(key))) invalidTimingPolicy(code, 'timing')
  const timing = Object.fromEntries(TIMING_KEYS.map((key) => [key, value[key]]))
  if (!Number.isInteger(timing.scheduledPrepLeadMinutes) || timing.scheduledPrepLeadMinutes < 0 || timing.scheduledPrepLeadMinutes > 240) invalidTimingPolicy(code, 'scheduledPrepLeadMinutes')
  if (!Number.isInteger(timing.scheduledLateGraceMinutes) || timing.scheduledLateGraceMinutes < 0 || timing.scheduledLateGraceMinutes > 120) invalidTimingPolicy(code, 'scheduledLateGraceMinutes')
  if (!Number.isInteger(timing.immediateLateAfterMinutes) || timing.immediateLateAfterMinutes < 1 || timing.immediateLateAfterMinutes > 180) invalidTimingPolicy(code, 'immediateLateAfterMinutes')
  if (!Number.isInteger(timing.immediateVeryLateAfterMinutes) || timing.immediateVeryLateAfterMinutes <= timing.immediateLateAfterMinutes || timing.immediateVeryLateAfterMinutes > 240) invalidTimingPolicy(code, 'immediateVeryLateAfterMinutes')
  return Object.freeze(timing)
}

export const parseOrderTimingPolicySnapshot = (value) => {
  if (value == null) return null
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return validateOrderTimingPolicy(parsed, 'ORDER_TIMING_SNAPSHOT_INVALID')
  } catch (error) {
    if (error?.code === 'ORDER_TIMING_SNAPSHOT_INVALID') throw error
    invalidTimingPolicy('ORDER_TIMING_SNAPSHOT_INVALID', 'timingPolicySnapshot')
  }
}

export const serializeOrderTimingPolicySnapshot = (value) => JSON.stringify(validateOrderTimingPolicy(value))

export const selectOrderTimingPolicy = (order, currentTiming = LEGACY_TIMING) => {
  if (!TERMINAL_STATUSES.has(order?.status)) return validateOrderTimingPolicy(currentTiming)
  if (order?.timingPolicySnapshot == null) return LEGACY_TIMING
  return parseOrderTimingPolicySnapshot(order.timingPolicySnapshot)
}

export const validateOrderSchedule = (order = {}, now = new Date(), maxDays = SCHEDULE_MAX_DAYS) => {
  if (!SCHEDULE_TYPES.has(order?.type)) return { ok: false, code: 'SCHEDULE_TYPE_NOT_ALLOWED' }
  const scheduled = validDate(order?.scheduledFor)
  const reference = validDate(now)
  const orderDay = businessDayNumber(order?.orderDate)
  if (!scheduled || !reference || orderDay == null || !Number.isInteger(maxDays) || maxDays < 0) {
    return { ok: false, code: 'SCHEDULE_INVALID' }
  }
  if (scheduled <= reference) return { ok: false, code: 'SCHEDULE_IN_PAST' }

  const scheduledBusinessDate = getBusinessDate(scheduled)
  if (scheduledBusinessDate !== order.orderDate) return { ok: false, code: 'SCHEDULE_DATE_MISMATCH' }

  const todayDay = businessDayNumber(getBusinessDate(reference))
  if (todayDay == null) return { ok: false, code: 'SCHEDULE_INVALID' }
  const daysAhead = orderDay - todayDay
  if (daysAhead < 0) return { ok: false, code: 'SCHEDULE_IN_PAST' }
  if (daysAhead > maxDays) return { ok: false, code: 'SCHEDULE_OUT_OF_RANGE' }

  return { ok: true, scheduledFor: scheduled.toISOString(), daysAhead }
}

const validDate = (value) => {
  if (!value) return null
  const date = value instanceof Date ? new Date(value) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const timeZoneParts = (date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FINANCE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]))
}

export const businessDateTimeToIso = (dateValue, timeValue) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || '')) || !/^\d{2}:\d{2}$/.test(String(timeValue || ''))) return null
  const [year, month, day] = dateValue.split('-').map(Number)
  const [hour, minute] = timeValue.split(':').map(Number)
  const calendarCheck = new Date(Date.UTC(year, month - 1, day))
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59
    || calendarCheck.getUTCFullYear() !== year || calendarCheck.getUTCMonth() !== month - 1 || calendarCheck.getUTCDate() !== day) return null
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  const parts = timeZoneParts(new Date(localAsUtc))
  const zoneAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
  return new Date(localAsUtc - (zoneAsUtc - localAsUtc)).toISOString()
}

export const isFutureSameDaySchedule = (order, now = new Date()) => {
  if (!['Entrega', 'Retirada'].includes(order?.type)) return false
  const result = validateOrderSchedule(order, now, 0)
  return result.ok && result.daysAhead === 0
}

export const getOperationalStartAt = (order, currentTiming = LEGACY_TIMING) => {
  const created = validDate(order?.createdAt)
  if (!created) return null
  const policy = selectOrderTimingPolicy(order, currentTiming)
  const scheduled = validDate(order?.scheduledFor)
  if (!scheduled) return created
  const prep = new Date(scheduled.getTime() - policy.scheduledPrepLeadMinutes * 60_000)
  return created > prep ? created : prep
}

export const getScheduledLateAt = (order, currentTiming = LEGACY_TIMING) => {
  const scheduled = validDate(order?.scheduledFor)
  if (!scheduled) return null
  const policy = selectOrderTimingPolicy(order, currentTiming)
  return new Date(scheduled.getTime() + policy.scheduledLateGraceMinutes * 60_000)
}

export const getOrderLateAt = (order, currentTiming = LEGACY_TIMING) => {
  const scheduledLateAt = getScheduledLateAt(order, currentTiming)
  if (scheduledLateAt) return scheduledLateAt
  const start = getOperationalStartAt(order, currentTiming)
  const policy = selectOrderTimingPolicy(order, currentTiming)
  return start ? new Date(start.getTime() + policy.immediateLateAfterMinutes * 60_000) : null
}

export const getOrderMinutesLate = (order, now = new Date(), currentTiming = LEGACY_TIMING) => {
  const lateAt = getOrderLateAt(order, currentTiming)
  const reference = validDate(now)
  if (!lateAt || !reference) return 0
  return Math.max(0, Math.floor((reference.getTime() - lateAt.getTime()) / 60_000))
}

export const isScheduledWaiting = (order, now = new Date(), currentTiming = LEGACY_TIMING) => {
  const scheduled = validDate(order?.scheduledFor)
  const reference = validDate(now)
  const start = getOperationalStartAt(order, currentTiming)
  return Boolean(scheduled && reference && start && reference < start)
}

export const getOperationalElapsedMinutes = (order, now = new Date(), currentTiming = LEGACY_TIMING) => {
  const start = getOperationalStartAt(order, currentTiming)
  const reference = validDate(now)
  if (!start || !reference) return 0
  return Math.max(0, Math.floor((reference.getTime() - start.getTime()) / 60_000))
}

export const getOperationalDurationMinutes = (order, currentTiming = LEGACY_TIMING) => {
  const start = getOperationalStartAt(order, currentTiming)
  const finish = validDate(order?.finishedAt)
  if (!start || !finish || finish < start) return null
  return Math.floor((finish.getTime() - start.getTime()) / 60_000)
}
