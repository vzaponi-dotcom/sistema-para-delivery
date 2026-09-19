const ORIGIN_ORDER_IDS_STORAGE_KEY = 'printing-origin-order-ids'
export const readOriginOrderIds = (storage) => {
  try {
    const values = JSON.parse(storage?.getItem(ORIGIN_ORDER_IDS_STORAGE_KEY) || '[]')
    return new Set(Array.isArray(values) ? values.filter((id) => typeof id === 'string' && id) : [])
  } catch { return new Set() }
}
export const rememberOriginOrderId = (orderId, storage) => {
  const ids = readOriginOrderIds(storage)
  if (!orderId) return ids
  ids.add(orderId)
  try { storage?.setItem(ORIGIN_ORDER_IDS_STORAGE_KEY, JSON.stringify([...ids])) } catch { /* optional browser storage */ }
  return ids
}
