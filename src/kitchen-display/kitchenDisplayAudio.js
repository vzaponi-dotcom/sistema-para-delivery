import { createKitchenAlertPlayer } from '../infrastructure/audio/kitchenAlertPlayer.js'
import { TV_KITCHEN_ALERT_DEFAULTS } from '../shared/utils/kitchenAlertCatalog.js'

export function createKitchenDisplayAudio({ createContext } = {}) {
  const player = createKitchenAlertPlayer({
    createContext,
    defaultProfile: TV_KITCHEN_ALERT_DEFAULTS.profile,
    defaultVolume: TV_KITCHEN_ALERT_DEFAULTS.volume,
  })

  return Object.freeze({
    unlock: player.unlock,
    playArrival: (options) => player.play(options),
    preview: (options) => player.play(options),
    close: player.close,
  })
}
