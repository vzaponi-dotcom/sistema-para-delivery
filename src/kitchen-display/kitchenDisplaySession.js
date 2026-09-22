import { pairKitchenDisplay, readKitchenDisplayState } from './kitchenDisplayApi.js'

export function readPairingToken(location = globalThis.location) {
  const fragment = location?.hash?.startsWith('#') ? location.hash.slice(1) : ''
  const token = new URLSearchParams(fragment).get('token')?.trim()
  return token || null
}

export async function bootstrapKitchenDisplay({
  location = globalThis.location,
  history = globalThis.history,
  pair = pairKitchenDisplay,
  readState = readKitchenDisplayState,
} = {}) {
  const token = readPairingToken(location)
  if (token) {
    try {
      await pair(token)
    } catch (error) {
      error.pairing = true
      throw error
    } finally {
      history.replaceState(null, '', `${location.pathname || '/cozinha-tv'}${location.search || ''}`)
    }
  }
  return readState()
}
