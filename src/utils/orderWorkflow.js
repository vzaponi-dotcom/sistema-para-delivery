const FINAL_STATUSES = new Set(['Entregue', 'Finalizado', 'Despachado'])

const pad = (value) => String(value).padStart(2, '0')

const parseDate = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const isValidDateValue = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
}

export const toLocalDateValue = (value = new Date()) => {
  const parsed = value instanceof Date ? new Date(value) : new Date(value)
  if (Number.isNaN(parsed.getTime())) return toLocalDateValue(new Date())

  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`
}

export const formatOrderDate = (value) => {
  if (!isValidDateValue(value)) return ''
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

export const formatOrderTime = (value) => {
  const parsed = parseDate(value)
  if (!parsed) return ''
  return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

export const formatElapsedDuration = (elapsedMinutes) => {
  const minutes = Math.max(0, Math.floor(Number(elapsedMinutes) || 0))
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${hours}h ${pad(remainder)} min`
}

export const normalizeOrderDate = (value, now = new Date()) => {
  const today = toLocalDateValue(now)
  if (!isValidDateValue(value)) return today
  return value > today ? today : value
}

const inferLegacyOrderDate = (order, now) => {
  if (order.orderDate) return normalizeOrderDate(order.orderDate, now)

  if (order.date === 'Ontem') {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return toLocalDateValue(yesterday)
  }

  if (order.date === 'Hoje') return toLocalDateValue(now)

  const createdAt = parseDate(order.createdAt)
  if (createdAt) return normalizeOrderDate(toLocalDateValue(createdAt), now)

  return toLocalDateValue(now)
}

const inferLegacyTimestamp = (order, now) => {
  const reference = new Date(now)

  if (order.date === 'Ontem') {
    reference.setDate(reference.getDate() - 1)
  }

  return reference.toISOString()
}

export const normalizeOrder = (order, now = new Date()) => {
  const isLegacyFinished = FINAL_STATUSES.has(order.status)
  const parsedFinishedAt = parseDate(order.finishedAt)
  const finishedAt = parsedFinishedAt?.toISOString() ?? (isLegacyFinished ? inferLegacyTimestamp(order, now) : null)
  const parsedCreatedAt = parseDate(order.createdAt)
  const createdAt = parsedCreatedAt?.toISOString() ?? inferLegacyTimestamp(order, now)
  const orderDate = inferLegacyOrderDate(order, now)

  return {
    ...order,
    status: finishedAt ? 'Finalizado' : 'Em preparo',
    orderDate,
    date: formatOrderDate(orderDate),
    createdAt,
    finishedAt,
  }
}

export const isOrderFinished = (order) => Boolean(parseDate(order?.finishedAt))

export const getElapsedMinutes = (order, now = new Date()) => {
  const createdAt = parseDate(order?.createdAt)
  const reference = new Date(now)

  if (!createdAt || Number.isNaN(reference.getTime())) return 0

  return Math.max(0, Math.floor((reference.getTime() - createdAt.getTime()) / 60_000))
}

export const getOrderTimingState = (order, now = new Date()) => {
  const elapsedMinutes = getElapsedMinutes(order, now)

  if (elapsedMinutes > 40) return 'very-late'
  if (elapsedMinutes > 30) return 'late'
  return 'on-time'
}

export const getOrderUrgency = (order, now = new Date()) => {
  const timingState = getOrderTimingState(order, now)

  if (timingState === 'very-late') return 'delayed'
  if (timingState === 'late') return 'attention'
  return 'normal'
}

export const getFinalActionLabel = (order) => (order?.type === 'Entrega' ? 'Saiu para entrega' : 'Finalizar')

export const isFinishedToday = (order, now = new Date()) => {
  const finishedAt = parseDate(order?.finishedAt)
  const reference = new Date(now)

  if (!finishedAt || Number.isNaN(reference.getTime())) return false

  return (
    finishedAt.getFullYear() === reference.getFullYear() &&
    finishedAt.getMonth() === reference.getMonth() &&
    finishedAt.getDate() === reference.getDate()
  )
}
