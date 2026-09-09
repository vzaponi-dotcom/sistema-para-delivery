const STATION_ID_KEY = 'delivery-print-station-id'
const qzPrinterKey = (stationId) => `delivery-qz-printer-name:${stationId}`

export const detectPrintStationPlatform = (userAgent = globalThis.navigator?.userAgent || '') => {
  const normalized = String(userAgent).toLowerCase()
  if (normalized.includes('android')) return 'android'
  if (normalized.includes('windows')) return 'windows'
  return 'other'
}

export const getDefaultPrintStationName = (platform) => {
  if (platform === 'windows') return 'Cozinha · Windows'
  if (platform === 'android') return 'Cozinha · Android'
  return 'Cozinha · Navegador'
}

export const isQzPrintStationEligible = ({ platform, qzPrinterName } = {}) => (
  platform === 'windows' && Boolean(String(qzPrinterName ?? '').trim())
)

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

export const getQzPrinterName = (storage = globalThis.localStorage, stationId) => {
  const value = String(storage?.getItem?.(qzPrinterKey(stationId)) ?? '').trim()
  return value || null
}

export const saveQzPrinterName = (storage = globalThis.localStorage, stationId, printerName) => {
  const value = String(printerName ?? '').trim()
  if (!value) {
    storage?.removeItem?.(qzPrinterKey(stationId))
    return ''
  }
  storage?.setItem?.(qzPrinterKey(stationId), value)
  return value
}

export const clearQzPrinterName = (storage = globalThis.localStorage, stationId) => {
  storage?.removeItem?.(qzPrinterKey(stationId))
}

