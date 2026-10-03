const qzPrinterKey = (businessId, stationId) => stationId === undefined ? `delivery-qz-printer-name:${businessId}` : `delivery-qz-printer-name:company:${encodeURIComponent(businessId)}:${encodeURIComponent(stationId)}`

export const getQzPrinterName = (storage = globalThis.localStorage, businessId, stationId) => {
  const value = String(storage?.getItem?.(qzPrinterKey(businessId, stationId)) ?? '').trim()
  return value || null
}

export const saveQzPrinterName = (storage = globalThis.localStorage, businessId, stationId, printerName) => {
  if (printerName === undefined) { printerName = stationId; stationId = undefined }
  const value = String(printerName ?? '').trim()
  if (!value) {
    if (!storage?.removeItem) throw Object.assign(new Error('Armazenamento local indisponível.'), { code: 'DEVICE_STORAGE_UNAVAILABLE' })
    storage.removeItem(qzPrinterKey(businessId, stationId))
    return ''
  }
  if (!storage?.setItem) throw Object.assign(new Error('Armazenamento local indisponível.'), { code: 'DEVICE_STORAGE_UNAVAILABLE' })
  storage.setItem(qzPrinterKey(businessId, stationId), value)
  return value
}

export const clearQzPrinterName = (storage = globalThis.localStorage, businessId, stationId) => {
  storage?.removeItem?.(qzPrinterKey(businessId, stationId))
}
