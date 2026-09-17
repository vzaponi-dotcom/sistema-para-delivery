export const DEVICE_PREFERENCES_UPDATED_AT_KEY = 'delivery-device-preferences-updated-at'

export function getBrowserLabel(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  const browsers = [
    { pattern: /Edg\/(\d+)/, name: 'Microsoft Edge' },
    { pattern: /OPR\/(\d+)/, name: 'Opera' },
    { pattern: /Firefox\/(\d+)/, name: 'Mozilla Firefox' },
    { pattern: /Chrome\/(\d+)/, name: 'Google Chrome' },
    { pattern: /Version\/(\d+).*Safari\//, name: 'Safari' },
  ]
  for (const browser of browsers) {
    const match = userAgent.match(browser.pattern)
    if (match) return `${browser.name} ${match[1]}`
  }
  return 'Navegador atual'
}

export function readDevicePreferencesUpdatedAt(storage = typeof window !== 'undefined' ? window.localStorage : null) {
  try {
    return storage?.getItem(DEVICE_PREFERENCES_UPDATED_AT_KEY) || ''
  } catch {
    return ''
  }
}

export function getLocalStorageUsageBytes(storage = typeof window !== 'undefined' ? window.localStorage : null) {
  if (!storage) return null
  try {
    let characters = 0
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index) || ''
      const value = storage.getItem(key) || ''
      characters += key.length + value.length
    }
    return characters * 2
  } catch {
    return null
  }
}

export function formatStorageUsage(bytes) {
  if (bytes == null) return 'Indisponível'
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`
}

export function formatDeviceTimestamp(value) {
  if (!value) return 'Ainda não registrada'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Ainda não registrada'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function writeDevicePreferencesUpdatedAt(storage, isoTimestamp) {
  try {
    storage?.setItem(DEVICE_PREFERENCES_UPDATED_AT_KEY, isoTimestamp)
  } catch {
    // The preference itself was already persisted; timestamp metadata is best effort.
  }
}
