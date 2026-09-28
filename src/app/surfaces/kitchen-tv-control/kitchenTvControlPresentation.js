export const KITCHEN_TV_TELEMETRY_FRESH_MS = 10_000
export const KITCHEN_TV_NEAR_LIMIT_MS = 5 * 60_000

const asDate = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const isKitchenTvTelemetryFresh = (
  telemetry,
  now = new Date(),
  freshnessMs = KITCHEN_TV_TELEMETRY_FRESH_MS,
) => {
  const reportedAt = asDate(telemetry?.reportedAt)
  const reference = asDate(now)
  if (!reportedAt || !reference) return false
  const age = reference.getTime() - reportedAt.getTime()
  return age >= 0 && age <= freshnessMs
}

export const shortKitchenTvClientName = (value) => {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (!normalized) return 'Cliente'
  const [first] = normalized.split(' ')
  return first.slice(0, 18)
}

export const kitchenTvOperationalStatus = (entry, now = new Date()) => {
  if (entry?.timingState === 'late' || entry?.timingState === 'very-late') {
    return { key: 'late', label: 'ATRASADO' }
  }

  const lateAt = asDate(entry?.lateAt)
  const reference = asDate(now)
  if (lateAt && reference) {
    const remaining = lateAt.getTime() - reference.getTime()
    if (remaining >= 0 && remaining <= KITCHEN_TV_NEAR_LIMIT_MS) {
      return { key: 'near-limit', label: 'PRÓXIMO DO LIMITE' }
    }
  }

  return { key: 'preparing', label: 'EM PREPARO' }
}

export const kitchenTvVisibility = ({
  orderId,
  hiddenOrderIds = [],
  telemetry,
  telemetryFresh = isKitchenTvTelemetryFresh(telemetry),
}) => {
  const normalizedId = String(orderId)
  if (hiddenOrderIds.some((id) => String(id) === normalizedId)) {
    return { key: 'hidden', label: 'Retirado' }
  }
  if (!telemetryFresh) return { key: 'unknown', label: 'TV sem sinal' }

  const visible = new Set((telemetry?.visibleOrderIds || []).map(String))
  return visible.has(normalizedId)
    ? { key: 'visible', label: 'Na TV' }
    : { key: 'offscreen', label: 'Fora' }
}

export const countKitchenTvOffscreen = (entries = [], state, telemetryFresh) => {
  if (!telemetryFresh) return null
  return entries.reduce((count, entry) => {
    const visibility = kitchenTvVisibility({
      orderId: entry?.order?.id,
      hiddenOrderIds: state?.hiddenOrderIds,
      telemetry: state?.telemetry,
      telemetryFresh,
    })
    return count + (visibility.key === 'offscreen' ? 1 : 0)
  }, 0)
}
