const FINAL_STATUSES = new Set(['Entregue', 'Finalizado', 'Despachado'])

const parseDate = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
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

  return {
    ...order,
    status: finishedAt ? 'Finalizado' : 'Em preparo',
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

export const getOrderUrgency = (order, now = new Date()) => {
  const elapsedMinutes = getElapsedMinutes(order, now)

  if (elapsedMinutes >= 25) return 'delayed'
  if (elapsedMinutes >= 15) return 'attention'
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
