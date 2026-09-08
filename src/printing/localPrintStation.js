const STATION_ID_KEY = 'delivery-print-station-id'
const fingerprintKey = (stationId) => `delivery-printer-fingerprint:${stationId}`
const qzPrinterKey = (stationId) => `delivery-qz-printer-name:${stationId}`

const fingerprintFromInfo = (info = {}) => {
  const fingerprint = {}
  for (const key of ['usbVendorId', 'usbProductId', 'bluetoothServiceClassId']) {
    if (info[key] !== undefined && info[key] !== null && info[key] !== '') fingerprint[key] = info[key]
  }
  return fingerprint
}

const fingerprintsEqual = (left, right) => {
  const keys = ['usbVendorId', 'usbProductId', 'bluetoothServiceClassId']
  const meaningful = keys.filter((key) => left?.[key] !== undefined || right?.[key] !== undefined)
  return meaningful.length > 0 && meaningful.every((key) => left?.[key] === right?.[key])
}

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

export const getPrinterFingerprint = (storage = globalThis.localStorage, stationId) => {
  const raw = storage?.getItem?.(fingerprintKey(stationId))
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

export const savePrinterFingerprint = (storage = globalThis.localStorage, stationId, port) => {
  const fingerprint = fingerprintFromInfo(port?.getInfo?.() || {})
  storage?.setItem?.(fingerprintKey(stationId), JSON.stringify(fingerprint))
  return fingerprint
}

export const clearPrinterFingerprint = (storage = globalThis.localStorage, stationId) => {
  storage?.removeItem?.(fingerprintKey(stationId))
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

export const findAuthorizedPrinterPort = async (serial = globalThis.navigator?.serial, storage = globalThis.localStorage, stationId) => {
  if (!serial?.getPorts) return null
  const ports = await serial.getPorts()
  if (!Array.isArray(ports) || ports.length === 0) return null

  const saved = getPrinterFingerprint(storage, stationId)
  if (saved) {
    const matches = ports.filter((port) => fingerprintsEqual(saved, fingerprintFromInfo(port?.getInfo?.() || {})))
    return matches.length === 1 ? matches[0] : null
  }

  return ports.length === 1 ? ports[0] : null
}
