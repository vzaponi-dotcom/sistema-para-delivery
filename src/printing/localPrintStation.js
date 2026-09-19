const STATION_ID_KEY = 'delivery-print-station-id'

export const detectPrintStationPlatform = (userAgent = globalThis.navigator?.userAgent || '') => {
  const normalized = String(userAgent).toLowerCase()
  if (normalized.includes('android')) return 'android'
  if (normalized.includes('windows')) return 'windows'
  return 'other'
}

export const detectPrintStationUiPlatform = (userAgent = globalThis.navigator?.userAgent || '') => {
  const normalized = String(userAgent).toLowerCase()
  if (normalized.includes('android')) return 'android'
  if (normalized.includes('windows')) return 'windows'
  if (/(iphone|ipad|ipod)/u.test(normalized)) return 'ios'
  if (normalized.includes('macintosh') && normalized.includes('mobile')) return 'ios'
  return 'other'
}

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
