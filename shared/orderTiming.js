import { FINANCE_TIME_ZONE, getBusinessDate } from './finance.js'

export const SCHEDULED_PREP_LEAD_MINUTES = 50
export const SCHEDULED_LATE_GRACE_MINUTES = 15
export const IMMEDIATE_LATE_AFTER_MINUTES = 30

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
  const scheduled = validDate(order?.scheduledFor)
  const reference = validDate(now)
  return Boolean(scheduled && reference
    && (!order?.orderDate || order.orderDate === getBusinessDate(reference))
    && getBusinessDate(scheduled) === getBusinessDate(reference)
    && scheduled > reference)
}

export const getOperationalStartAt = (order) => {
  const created = validDate(order?.createdAt)
  if (!created) return null
  const scheduled = validDate(order?.scheduledFor)
  if (!scheduled) return created
  const prep = new Date(scheduled.getTime() - SCHEDULED_PREP_LEAD_MINUTES * 60_000)
  return created > prep ? created : prep
}

export const getScheduledLateAt = (order) => {
  const scheduled = validDate(order?.scheduledFor)
  return scheduled ? new Date(scheduled.getTime() + SCHEDULED_LATE_GRACE_MINUTES * 60_000) : null
}

export const getOrderLateAt = (order) => {
  const scheduledLateAt = getScheduledLateAt(order)
  if (scheduledLateAt) return scheduledLateAt
  const start = getOperationalStartAt(order)
  return start ? new Date(start.getTime() + IMMEDIATE_LATE_AFTER_MINUTES * 60_000) : null
}

export const getOrderMinutesLate = (order, now = new Date()) => {
  const lateAt = getOrderLateAt(order)
  const reference = validDate(now)
  if (!lateAt || !reference) return 0
  return Math.max(0, Math.floor((reference.getTime() - lateAt.getTime()) / 60_000))
}

export const isScheduledWaiting = (order, now = new Date()) => {
  const scheduled = validDate(order?.scheduledFor)
  const reference = validDate(now)
  const start = getOperationalStartAt(order)
  return Boolean(scheduled && reference && start && reference < start)
}

export const getOperationalElapsedMinutes = (order, now = new Date()) => {
  const start = getOperationalStartAt(order)
  const reference = validDate(now)
  if (!start || !reference) return 0
  return Math.max(0, Math.floor((reference.getTime() - start.getTime()) / 60_000))
}

export const getOperationalDurationMinutes = (order) => {
  const start = getOperationalStartAt(order)
  const finish = validDate(order?.finishedAt)
  if (!start || !finish || finish < start) return null
  return Math.floor((finish.getTime() - start.getTime()) / 60_000)
}
