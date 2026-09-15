import { APPLICATION_CAPABILITIES } from '../../shared/settingsAccess.js'

export const CAPABILITIES = APPLICATION_CAPABILITIES

const knownCapabilities = new Set(CAPABILITIES)

export function hasCapability(granted, key) {
  return (
    granted instanceof Set &&
    knownCapabilities.has(key) &&
    granted.has(key)
  )
}

export function legacyCapabilities(authenticated) {
  return authenticated ? new Set(CAPABILITIES) : new Set()
}
