const fullscreenMethods = [
  'requestFullscreen',
  'webkitRequestFullscreen',
  'webkitRequestFullScreen',
  'mozRequestFullScreen',
  'msRequestFullscreen',
]

export async function requestKitchenDisplayFullscreen(doc = globalThis.document) {
  const element = doc?.documentElement
  if (!element) return false

  const method = fullscreenMethods.find((name) => typeof element[name] === 'function')
  if (!method) return false

  try {
    await Promise.resolve(element[method].call(element))
    return true
  } catch {
    return false
  }
}

export function isKitchenDisplayFullscreen(doc = globalThis.document) {
  return Boolean(
    doc?.fullscreenElement
    || doc?.webkitFullscreenElement
    || doc?.webkitCurrentFullScreenElement
    || doc?.mozFullScreenElement
    || doc?.msFullscreenElement,
  )
}
