import { getBusinessDate } from '../../../../shared/finance.js'

export const REPORTING_VIEWS = Object.freeze(['overview', 'operation', 'sales', 'products', 'detail'])
export const REPORTING_PAGE_SIZES = Object.freeze([25, 50, 100])

const VIEW_SET = new Set(REPORTING_VIEWS)
const TYPE_SET = new Set(['Entrega', 'Retirada', 'Local'])
const SCHEDULE_SET = new Set(['immediate', 'scheduled'])
const DEADLINE_SET = new Set(['on-time', 'late'])
const QUERY_KEYS = Object.freeze([
  'view', 'from', 'to', 'type', 'schedule', 'status', 'paymentMethod', 'category',
  'product', 'customer', 'orderHourFrom', 'orderHourTo', 'operationalDeadline',
  'search', 'sort', 'page', 'pageSize',
])
const POPULATION_KEYS = new Set([
  'from', 'to', 'type', 'schedule', 'status', 'paymentMethod', 'category',
  'product', 'customer', 'orderHourFrom', 'orderHourTo', 'operationalDeadline',
  'search', 'sort',
])

const validDateValue = (value) => {
  const text = String(value || '')
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return null
  const [, rawYear, rawMonth, rawDay] = match
  const year = Number(rawYear)
  const month = Number(rawMonth)
  const day = Number(rawDay)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    ? text
    : null
}

const cleanText = (value, maxLength = 120) => {
  const text = String(value ?? '').trim()
  return text ? text.slice(0, maxLength) : ''
}

const optionalText = (value, maxLength = 120) => cleanText(value, maxLength) || null

const normalizeHour = (value) => {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 && number <= 23 ? number : null
}

const normalizePositiveInteger = (value, fallback) => {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : fallback
}

const currentBusinessDate = (today) => validDateValue(today) || getBusinessDate(new Date())

export function normalizeReportingQuery(searchParams = new URLSearchParams(), { today } = {}) {
  const params = searchParams instanceof URLSearchParams
    ? searchParams
    : new URLSearchParams(searchParams)
  const businessToday = currentBusinessDate(today)
  const defaultFrom = `${businessToday.slice(0, 7)}-01`
  const view = VIEW_SET.has(params.get('view')) ? params.get('view') : 'overview'
  const pageSizeCandidate = normalizePositiveInteger(params.get('pageSize'), 25)
  const pageSize = REPORTING_PAGE_SIZES.includes(pageSizeCandidate) ? pageSizeCandidate : 25

  return {
    view,
    from: validDateValue(params.get('from')) || defaultFrom,
    to: validDateValue(params.get('to')) || businessToday,
    type: TYPE_SET.has(params.get('type')) ? params.get('type') : null,
    schedule: SCHEDULE_SET.has(params.get('schedule')) ? params.get('schedule') : null,
    status: optionalText(params.get('status'), 80),
    paymentMethod: optionalText(params.get('paymentMethod'), 80),
    category: optionalText(params.get('category'), 120),
    product: optionalText(params.get('product'), 160),
    customer: optionalText(params.get('customer'), 160),
    orderHourFrom: normalizeHour(params.get('orderHourFrom')),
    orderHourTo: normalizeHour(params.get('orderHourTo')),
    operationalDeadline: DEADLINE_SET.has(params.get('operationalDeadline')) ? params.get('operationalDeadline') : null,
    search: cleanText(params.get('search'), 160),
    sort: optionalText(params.get('sort'), 80) || 'date-desc',
    page: normalizePositiveInteger(params.get('page'), 1),
    pageSize,
  }
}

export function reportingQueryToSearchParams(query) {
  const params = new URLSearchParams()
  for (const key of QUERY_KEYS) {
    const value = query?.[key]
    if (value == null || value === '') continue
    params.set(key, String(value))
  }
  return params
}

export function patchReportingQuery(current, patch) {
  if (!patch || typeof patch !== 'object') return current
  const allowed = Object.fromEntries(
    Object.entries(patch).filter(([key]) => QUERY_KEYS.includes(key)),
  )
  if (!Object.keys(allowed).length) return current
  const next = { ...current, ...allowed }
  if (Object.keys(allowed).some((key) => POPULATION_KEYS.has(key))) next.page = 1
  return normalizeReportingQuery(reportingQueryToSearchParams(next), { today: current?.to })
}
