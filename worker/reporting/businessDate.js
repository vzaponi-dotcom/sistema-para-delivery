import { getBusinessDate } from '../../shared/finance.js'

const DAY_MS = 86_400_000

export function shiftCalendarDate(value, days) {
  const parsed = Date.parse(`${value}T00:00:00.000Z`)
  return new Date(parsed + days * DAY_MS).toISOString().slice(0, 10)
}

// Locate the first UTC millisecond of a São Paulo calendar day without assuming UTC-3.
export function businessDayStartUtc(value) {
  const middle = Date.parse(`${value}T00:00:00.000Z`)
  let low = middle - DAY_MS
  let high = middle + DAY_MS
  while (low < high) {
    const midpoint = low + Math.floor((high - low) / 2)
    if (getBusinessDate(new Date(midpoint)) < value) low = midpoint + 1
    else high = midpoint
  }
  return new Date(low).toISOString()
}

export function businessDateRangeUtc(from, to) {
  return [businessDayStartUtc(from), businessDayStartUtc(shiftCalendarDate(to, 1))]
}
