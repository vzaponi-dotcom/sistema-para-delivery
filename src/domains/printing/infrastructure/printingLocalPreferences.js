const STATION_ID_KEY = 'delivery-print-station-id'
const ORIGIN_ORDER_IDS_STORAGE_KEY = 'printing-origin-order-ids'

export const getOrCreateLocalPrintStationId = (
  storage = globalThis.localStorage,
  randomUUID = () => globalThis.crypto.randomUUID(),
) => {
  const existing = storage?.getItem?.(STATION_ID_KEY)
  if (existing) return existing
  const id = String(randomUUID())
  storage?.setItem?.(STATION_ID_KEY, id)
  return id
}

export const readOriginOrderIds = (storage = globalThis.localStorage) => {
  try {
    const values = JSON.parse(storage?.getItem?.(ORIGIN_ORDER_IDS_STORAGE_KEY) || '[]')
    return new Set(Array.isArray(values) ? values.filter((id) => typeof id === 'string' && id) : [])
  } catch {
    return new Set()
  }
}

export const rememberOriginOrderId = (orderId, storage = globalThis.localStorage) => {
  const ids = readOriginOrderIds(storage)
  if (!orderId) return ids
  ids.add(orderId)
  try { storage?.setItem?.(ORIGIN_ORDER_IDS_STORAGE_KEY, JSON.stringify([...ids])) } catch { /* optional browser storage */ }
  return ids
}
