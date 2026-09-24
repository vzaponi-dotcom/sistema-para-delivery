const resolveKitchenDisplayScope = () => {
  if (typeof globalThis !== 'undefined') return globalThis
  if (typeof window !== 'undefined') return window
  return undefined
}

export const installKitchenDisplayLegacyCompat = (scope = resolveKitchenDisplayScope()) => {
  if (!scope) return { globalThis: false, fromEntries: false }

  let installedGlobalThis = false
  if (typeof scope.globalThis === 'undefined') {
    try {
      scope.globalThis = scope
      installedGlobalThis = true
    } catch {
      // Some embedded browsers expose a non-extensible global object.
    }
  }

  const ObjectCtor = scope.Object || Object
  let installedFromEntries = false
  if (typeof ObjectCtor.fromEntries !== 'function') {
    ObjectCtor.fromEntries = function fromEntries(entries) {
      if (entries == null) throw new TypeError('Object.fromEntries requires an iterable')
      const result = {}
      for (const pair of entries) {
        if (pair == null) throw new TypeError('Iterator value is not an entry object')
        result[pair[0]] = pair[1]
      }
      return result
    }
    installedFromEntries = true
  }

  return { globalThis: installedGlobalThis, fromEntries: installedFromEntries }
}

installKitchenDisplayLegacyCompat()
