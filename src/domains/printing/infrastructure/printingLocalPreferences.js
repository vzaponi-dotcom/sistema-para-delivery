import { getLocalStorage } from '../../../infrastructure/storage/localStorage.js'

const STATION_ID_KEY = 'delivery-print-station-id'
const companyKey = (key, businessId) => businessId ? `${key}:company:${encodeURIComponent(businessId)}` : key
const ORIGIN_ORDER_IDS_STORAGE_KEY = 'printing-origin-order-ids'

export const getOrCreateLocalPrintStationId = (
  storage = globalThis.localStorage,
  randomUUID = () => globalThis.crypto.randomUUID(),
  businessId,
) => {
  const existing = storage?.getItem?.(companyKey(STATION_ID_KEY, businessId))
  if (existing) return existing
  const id = String(randomUUID())
  storage?.setItem?.(companyKey(STATION_ID_KEY, businessId), id)
  return id
}

export const readOriginOrderIds = (storage = getLocalStorage(), businessId) => {
  try {
    const values = JSON.parse(storage?.getItem?.(companyKey(ORIGIN_ORDER_IDS_STORAGE_KEY, businessId)) || '[]')
    return new Set(Array.isArray(values) ? values.filter((id) => typeof id === 'string' && id) : [])
  } catch {
    return new Set()
  }
}

export const rememberOriginOrderId = (orderId, storage = getLocalStorage(), businessId) => {
  const ids = readOriginOrderIds(storage, businessId)
  if (!orderId) return ids
  ids.add(orderId)
  try { storage?.setItem?.(companyKey(ORIGIN_ORDER_IDS_STORAGE_KEY, businessId), JSON.stringify([...ids])) } catch { /* optional browser storage */ }
  return ids
}
