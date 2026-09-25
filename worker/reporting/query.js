import { apiError } from '../http.js'
import { shiftCalendarDate } from './businessDate.js'

const VIEWS = new Set(['overview', 'operation', 'sales', 'products', 'detail'])
const TYPES = new Set(['Entrega', 'Retirada', 'Local'])
const SCHEDULES = new Set(['immediate', 'scheduled'])
const DEADLINES = new Set(['on-time', 'late'])
const PAGE_SIZES = new Set([25, 50, 100])
const SORTS = new Set(['date-desc', 'date-asc', 'total-desc', 'total-asc', 'duration-desc', 'duration-asc'])
const PERIODS = new Set(['today', '7-days', '30-days', 'current-month', 'previous-month', 'custom'])
const KEYS = new Set(['view', 'period', 'from', 'to', 'type', 'schedule', 'status', 'paymentMethod', 'category', 'product', 'customer', 'orderHourFrom', 'orderHourTo', 'operationalDeadline', 'search', 'sort', 'page', 'pageSize', 'businessId', 'business_id', 'capabilities', 'capability'])

const fail = (code, message) => { throw apiError(400, code, message) }
const date = (value, key) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  if (!match) fail('REPORTING_INVALID_QUERY', `${key} inválido.`)
  const [, year, month, day] = match
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (Number(year) < 1 || parsed.getUTCFullYear() !== Number(year)
    || parsed.getUTCMonth() + 1 !== Number(month) || parsed.getUTCDate() !== Number(day)) {
    fail('REPORTING_INVALID_QUERY', `${key} inválido.`)
  }
  return value
}
const optional = (params, key) => {
  const value = params.get(key)
  return value === null || value.trim() === '' ? null : value.trim()
}
const saoPauloDate = (now) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now)
const integer = (params, key, fallback, allowed) => {
  const value = optional(params, key)
  if (value === null) return fallback
  if (!/^\d+$/.test(value)) fail('REPORTING_INVALID_QUERY', `${key} inválido.`)
  const parsed = Number(value)
  if (!allowed(parsed)) fail('REPORTING_INVALID_QUERY', `${key} inválido.`)
  return parsed
}

export function parseReportingQuery(input, { now = new Date() } = {}) {
  const params = input instanceof URLSearchParams ? input : new URLSearchParams(input)
  for (const key of params.keys()) if (!KEYS.has(key)) fail('REPORTING_UNKNOWN_QUERY', 'Parâmetro de relatório desconhecido.')
  const today = saoPauloDate(now)
  const from = date(optional(params, 'from') || `${today.slice(0, 8)}01`, 'from')
  const to = date(optional(params, 'to') || today, 'to')
  if (from > to || (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86400000 > 365) fail('REPORTING_INVALID_RANGE', 'Período de relatório inválido.')
  const enumValue = (key, values) => {
    const value = optional(params, key)
    if (value !== null && !values.has(value)) fail('REPORTING_INVALID_QUERY', `${key} inválido.`)
    return value
  }
  const fromHour = integer(params, 'orderHourFrom', null, (value) => value >= 0 && value <= 23)
  const toHour = integer(params, 'orderHourTo', null, (value) => value >= 0 && value <= 23)
  if (fromHour !== null && toHour !== null && fromHour > toHour) fail('REPORTING_INVALID_QUERY', 'Intervalo de horas inválido.')
  const search = optional(params, 'search')
  if (search?.length > 120) fail('REPORTING_INVALID_QUERY', 'Busca muito longa.')
  const view = enumValue('view', VIEWS) || 'overview'
  const query = {
    view, period: enumValue('period', PERIODS) || (params.has('from') || params.has('to') ? 'custom' : 'current-month'), from, to, type: enumValue('type', TYPES), schedule: enumValue('schedule', SCHEDULES),
    status: optional(params, 'status'), paymentMethod: optional(params, 'paymentMethod'), category: optional(params, 'category'),
    product: optional(params, 'product'), customer: optional(params, 'customer'), orderHourFrom: fromHour, orderHourTo: toHour,
    operationalDeadline: enumValue('operationalDeadline', DEADLINES), search, sort: optional(params, 'sort'),
    page: integer(params, 'page', 1, (value) => value >= 1), pageSize: integer(params, 'pageSize', 25, (value) => PAGE_SIZES.has(value)),
  }
  if (query.period !== 'custom') {
    const monthStart = `${today.slice(0, 7)}-01`
    const previousMonthStart = shiftCalendarDate(monthStart, -1).slice(0, 7) + '-01'
    const expected = {
      today: [today, today], '7-days': [shiftCalendarDate(today, -6), today],
      '30-days': [shiftCalendarDate(today, -29), today],
      'current-month': [monthStart, today],
      'previous-month': [previousMonthStart, shiftCalendarDate(monthStart, -1)],
    }[query.period]
    if (query.from !== expected[0] || query.to !== expected[1]) fail('REPORTING_INVALID_RANGE', 'Período predefinido incompatível com as datas.')
  }
  if (query.sort !== null && !SORTS.has(query.sort)) fail('REPORTING_INVALID_QUERY', 'Ordenação inválida.')
  const inapplicable = {
    overview: ['operationalDeadline', 'orderHourFrom', 'orderHourTo', 'search', 'sort', 'page', 'pageSize', 'paymentMethod'],
    operation: ['paymentMethod', 'search', 'sort', 'page', 'pageSize', 'status'],
    sales: ['operationalDeadline', 'orderHourFrom', 'orderHourTo', 'search', 'sort', 'page', 'pageSize'],
    products: ['paymentMethod', 'operationalDeadline', 'orderHourFrom', 'orderHourTo', 'search', 'sort', 'page', 'pageSize', 'status'],
    detail: [],
  }
  for (const key of inapplicable[view]) {
    const value = query[key]
    const isDefault = (key === 'page' && value === 1) || (key === 'pageSize' && value === 25)
      || (key === 'sort' && value === 'date-desc')
    if (value !== null && !isDefault) fail('REPORTING_INAPPLICABLE_FILTER', `${key} não se aplica à visão ${view}.`)
  }
  return Object.freeze(query)
}
