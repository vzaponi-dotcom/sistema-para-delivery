import { normalizeNotificationCatalog } from './notificationCatalog.js'

export const notificationStorageKey = (businessId) => {
  const id = String(businessId || '').trim()
  return id ? `delivery-notifications:v1:${id}` : null
}

const validIds = (value, catalogIds) => Array.isArray(value)
  ? [...new Set(value.filter((id) => typeof id === 'string' && catalogIds.has(id)))]
  : []

const addId = (ids, id) => (typeof id === 'string' && id && !ids.includes(id) ? [...ids, id] : ids)

export const saveNotificationState = ({ storage, businessId, state }) => {
  const key = notificationStorageKey(businessId)
  if (!key) return false
  try {
    storage?.setItem(key, JSON.stringify(state))
    return typeof storage?.setItem === 'function'
  } catch {
    return false
  }
}

export const loadNotificationState = ({ storage, businessId, catalog = [] }) => {
  const notifications = normalizeNotificationCatalog(catalog)
  const ids = notifications.map((item) => item.id)
  const idSet = new Set(ids)
  const key = notificationStorageKey(businessId)
  let saved
  try {
    saved = key ? JSON.parse(storage?.getItem(key) ?? 'null') : null
  } catch {
    saved = null
  }
  const state = saved?.version === 1 && Array.isArray(saved.knownIds)
    ? {
      version: 1,
      knownIds: ids,
      presentedIds: validIds(saved.presentedIds, idSet),
      readIds: validIds(saved.readIds, idSet),
    }
    : {
      version: 1,
      knownIds: ids,
      presentedIds: ids.slice(1),
      readIds: ids.slice(1),
    }
  saveNotificationState({ storage, businessId, state })
  return state
}

export const markPresented = (state, id) => ({ ...state, presentedIds: addId(state.presentedIds, id) })
export const markRead = (state, id) => ({ ...state, presentedIds: addId(state.presentedIds, id), readIds: addId(state.readIds, id) })
export const getUnreadCount = (catalog, state) => catalog.filter((item) => !state.readIds.includes(item.id)).length
export const getAutomaticNotification = (catalog, state) => {
  const latest = catalog[0]
  return latest && !state.presentedIds.includes(latest.id) ? latest : null
}
