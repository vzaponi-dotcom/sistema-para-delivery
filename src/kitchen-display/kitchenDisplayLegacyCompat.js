const resolveRoot = () => {
  if (typeof globalThis !== 'undefined') return globalThis
  if (typeof window !== 'undefined') return window
  if (typeof self !== 'undefined') return self
  return {}
}

export const objectFromEntriesCompat = (entries) => {
  const result = {}
  for (const entry of entries || []) {
    if (!entry || entry.length < 2) throw new TypeError('Object.fromEntries requires key/value entries')
    result[entry[0]] = entry[1]
  }
  return result
}

export function installKitchenDisplayLegacyCompat(root = resolveRoot()) {
  if (!root.globalThis) {
    try { root.globalThis = root } catch { /* best effort for old embedded browsers */ }
  }

  const ObjectCtor = root.Object
  if (ObjectCtor && typeof ObjectCtor.fromEntries !== 'function') {
    ObjectCtor.fromEntries = objectFromEntriesCompat
  }

  return root
}

export function getKitchenDisplayCompatibilityIssues(root = resolveRoot()) {
  const issues = []
  if (!root || typeof root !== 'object') return ['global']
  if (typeof root.fetch !== 'function') issues.push('fetch')
  if (typeof root.Promise !== 'function') issues.push('Promise')
  if (typeof root.Map !== 'function') issues.push('Map')
  if (typeof root.Set !== 'function') issues.push('Set')
  if (!root.Intl || typeof root.Intl.DateTimeFormat !== 'function') issues.push('Intl.DateTimeFormat')
  if (!root.Object || typeof root.Object.fromEntries !== 'function') issues.push('Object.fromEntries')
  return issues
}

installKitchenDisplayLegacyCompat()
