import {
  createKitchenDisplayPairingRequest,
  readKitchenDisplayPairingStatus,
  readKitchenDisplayState,
} from './kitchenDisplayApi.js'

const canRestartPairing = (error) => error?.status === 401 || error?.status === 410

export async function bootstrapKitchenDisplay({
  readState = readKitchenDisplayState,
  readPairingStatus = readKitchenDisplayPairingStatus,
  createPairingRequest = createKitchenDisplayPairingRequest,
} = {}) {
  try {
    return { kind: 'paired', state: await readState() }
  } catch (error) {
    if (error?.status !== 401 && error?.status !== 403) throw error
  }

  try {
    const pairing = await readPairingStatus()
    if (pairing?.paired) return { kind: 'paired', state: await readState() }
    return { kind: 'pairing', pairing }
  } catch (error) {
    if (!canRestartPairing(error)) throw error
    return { kind: 'pairing', pairing: await createPairingRequest() }
  }
}
