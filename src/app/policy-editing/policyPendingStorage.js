export const POLICY_PENDING_TTL_MS = 24 * 60 * 60 * 1000
const PREFIX = 'settings-pending:'
const storageKey = (contextKey, resourceKey) => `${PREFIX}${contextKey}:${resourceKey}`
const allowedPointer = (pointer) => ({
  resource: pointer.resource,
  ...(pointer.scopeId ? { scopeId: pointer.scopeId } : {}),
  mutationId: pointer.mutationId,
  payloadHash: pointer.payloadHash,
  startedAt: pointer.startedAt,
  contextId: pointer.contextId,
})
const validPointer = (value, contextKey) => Boolean(
  value && typeof value === 'object'
  && typeof value.resource === 'string' && value.resource
  && (value.scopeId === undefined || (typeof value.scopeId === 'string' && value.scopeId))
  && typeof value.mutationId === 'string' && value.mutationId
  && typeof value.payloadHash === 'string' && value.payloadHash
  && typeof value.startedAt === 'string' && Number.isFinite(Date.parse(value.startedAt))
  && value.contextId === contextKey
)

export function writePending(storage, contextKey, resourceKey, pointer) {
  try {
    const value = allowedPointer(pointer || {})
    if (!validPointer(value, contextKey)) throw new TypeError('Ponteiro de grava\u00e7\u00e3o pendente inv\u00e1lido.')
    storage.setItem(storageKey(contextKey, resourceKey), JSON.stringify(value))
    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
}

export function readPending(storage, contextKey, resourceKey, now = new Date()) {
  try {
    const raw = storage?.getItem(storageKey(contextKey, resourceKey))
    if (!raw) return null
    const value = JSON.parse(raw)
    if (!validPointer(value, contextKey)) return null
    return { ...allowedPointer(value), expired: now.getTime() - Date.parse(value.startedAt) >= POLICY_PENDING_TTL_MS }
  } catch {
    return null
  }
}

export function clearPending(storage, contextKey, resourceKey) {
  try { storage?.removeItem(storageKey(contextKey, resourceKey)); return true } catch { return false }
}

export function clearPendingContext(storage, contextKey) {
  try {
    const prefix = `${PREFIX}${contextKey}:`
    const keys = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key?.startsWith(prefix)) keys.push(key)
    }
    keys.forEach((key) => storage.removeItem(key))
    return true
  } catch {
    return false
  }
}
