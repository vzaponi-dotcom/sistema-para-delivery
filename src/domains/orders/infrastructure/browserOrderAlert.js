import { createKitchenAlertPlayer } from '../../../infrastructure/audio/kitchenAlertPlayer.js'

export const createBrowserOrderAlertPlayer = ({ windowObject = globalThis.window } = {}) => (
  createKitchenAlertPlayer({ windowObject })
)
