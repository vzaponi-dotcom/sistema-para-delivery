export const detectPrintStationPlatform = (userAgent = globalThis.navigator?.userAgent || '') => {
  const normalized = String(userAgent).toLowerCase()
  if (normalized.includes('android')) return 'android'
  if (normalized.includes('windows')) return 'windows'
  return 'other'
}

export const detectPrintStationUiPlatform = (userAgent = globalThis.navigator?.userAgent || '') => {
  const normalized = String(userAgent).toLowerCase()
  if (normalized.includes('android')) return 'android'
  if (normalized.includes('windows')) return 'windows'
  if (/(iphone|ipad|ipod)/u.test(normalized)) return 'ios'
  if (normalized.includes('macintosh') && normalized.includes('mobile')) return 'ios'
  return 'other'
}
