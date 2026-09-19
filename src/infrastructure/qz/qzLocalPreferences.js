const qzPrinterKey = (stationId) => `delivery-qz-printer-name:${stationId}`

export const getQzPrinterName = (storage = globalThis.localStorage, stationId) => {
  const value = String(storage?.getItem?.(qzPrinterKey(stationId)) ?? '').trim()
  return value || null
}

export const saveQzPrinterName = (storage = globalThis.localStorage, stationId, printerName) => {
  const value = String(printerName ?? '').trim()
  if (!value) {
    if (!storage?.removeItem) throw Object.assign(new Error('Armazenamento local indisponível.'), { code: 'DEVICE_STORAGE_UNAVAILABLE' })
    storage.removeItem(qzPrinterKey(stationId))
    return ''
  }
  if (!storage?.setItem) throw Object.assign(new Error('Armazenamento local indisponível.'), { code: 'DEVICE_STORAGE_UNAVAILABLE' })
  storage.setItem(qzPrinterKey(stationId), value)
  return value
}

export const clearQzPrinterName = (storage = globalThis.localStorage, stationId) => {
  storage?.removeItem?.(qzPrinterKey(stationId))
}
