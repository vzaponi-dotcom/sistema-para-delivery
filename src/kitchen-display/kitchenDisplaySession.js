import {
  createKitchenDisplayPairingRequest,
  readKitchenDisplayPairingStatus,
  readKitchenDisplayState,
} from './kitchenDisplayApi.js'

export const KITCHEN_TV_PAIRING_STORAGE_KEY = 'kitchen-tv-pairing-request-token'

let volatilePairingToken = null

const storageGet = (storage) => {
  try { return storage?.getItem?.(KITCHEN_TV_PAIRING_STORAGE_KEY) || volatilePairingToken }
  catch { return volatilePairingToken }
}

const storageSet = (storage, value) => {
  volatilePairingToken = value || null
  try {
    if (value) storage?.setItem?.(KITCHEN_TV_PAIRING_STORAGE_KEY, value)
    else storage?.removeItem?.(KITCHEN_TV_PAIRING_STORAGE_KEY)
  } catch {
    // Some older Smart TV browsers restrict Web Storage. The in-memory fallback
    // still keeps the request stable for the lifetime of the page.
  }
}

const visiblePairing = (pairing) => pairing ? {
  paired: Boolean(pairing.paired),
  code: pairing.code,
  expiresAt: pairing.expiresAt,
} : pairing

async function createAndRememberPairing(createPairingRequest, storage) {
  const pairing = await createPairingRequest()
  if (pairing?.requestToken) storageSet(storage, pairing.requestToken)
  return visiblePairing(pairing)
}

export async function pollKitchenDisplayPairing({
  storage = globalThis.sessionStorage,
  readPairingStatus = readKitchenDisplayPairingStatus,
  createPairingRequest = createKitchenDisplayPairingRequest,
  readState = readKitchenDisplayState,
} = {}) {
  const storedToken = storageGet(storage)
  try {
    const pairing = await readPairingStatus(storedToken)
    if (pairing?.paired) {
      storageSet(storage, null)
      return { kind: 'paired', state: await readState() }
    }
    return { kind: 'pairing', pairing: visiblePairing(pairing) }
  } catch (error) {
    if (error?.status !== 401 && error?.status !== 410) throw error
    storageSet(storage, null)
    return { kind: 'pairing', pairing: await createAndRememberPairing(createPairingRequest, storage) }
  }
}

export async function bootstrapKitchenDisplay({
  storage = globalThis.sessionStorage,
  readState = readKitchenDisplayState,
  readPairingStatus = readKitchenDisplayPairingStatus,
  createPairingRequest = createKitchenDisplayPairingRequest,
} = {}) {
  try {
    storageSet(storage, null)
    return { kind: 'paired', state: await readState() }
  } catch (error) {
    if (error?.status !== 401 && error?.status !== 403) throw error
  }

  return pollKitchenDisplayPairing({ storage, readState, readPairingStatus, createPairingRequest })
}
