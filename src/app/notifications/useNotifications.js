import { useCallback, useMemo, useState } from 'react'
import { SYSTEM_NOTIFICATIONS, normalizeNotificationCatalog } from './notificationCatalog.js'
import { getAutomaticNotification, getUnreadCount, loadNotificationState, markPresented as present, markRead as read, saveNotificationState } from './notificationStore.js'

const browserStorage = () => {
  try { return globalThis.localStorage } catch { return undefined }
}

export function useNotifications({ businessId, catalog = SYSTEM_NOTIFICATIONS, storage } = {}) {
  const notifications = useMemo(() => normalizeNotificationCatalog(catalog), [catalog])
  const deviceStorage = storage === undefined ? browserStorage() : storage
  const scopeKey = `${businessId ?? ''}\u001f${notifications.map((item) => `${item.id}:${item.publishedAt}`).join('\u001f')}`
  const [snapshot, setSnapshot] = useState(() => ({ scopeKey, storage: deviceStorage, state: loadNotificationState({ storage: deviceStorage, businessId, catalog: notifications }) }))
  const current = snapshot.scopeKey === scopeKey && snapshot.storage === deviceStorage
    ? snapshot
    : { scopeKey, storage: deviceStorage, state: loadNotificationState({ storage: deviceStorage, businessId, catalog: notifications }) }
  if (current !== snapshot) setSnapshot(current)

  const update = useCallback((transition, id) => {
    setSnapshot((existing) => {
      const state = existing.scopeKey === scopeKey && existing.storage === deviceStorage
        ? existing.state
        : loadNotificationState({ storage: deviceStorage, businessId, catalog: notifications })
      const nextState = transition(state, id)
      saveNotificationState({ storage: deviceStorage, businessId, state: nextState })
      return { scopeKey, storage: deviceStorage, state: nextState }
    })
  }, [businessId, deviceStorage, notifications, scopeKey])

  return {
    notifications,
    unreadCount: getUnreadCount(notifications, current.state),
    automaticNotification: getAutomaticNotification(notifications, current.state),
    isRead: (id) => current.state.readIds.includes(id),
    markPresented: (id) => update(present, id),
    markRead: (id) => update(read, id),
  }
}
