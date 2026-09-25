import {
  ADMIN_KITCHEN_ALERT_DEFAULTS,
  getKitchenAlertProfile,
  getKitchenAlertVolume,
} from '../../shared/utils/kitchenAlertCatalog.js'

const defaultCreateContext = (windowObject = globalThis.window) => {
  const target = windowObject || globalThis
  const AudioContextClass = target?.AudioContext || target?.webkitAudioContext
  return AudioContextClass ? new AudioContextClass() : null
}

export function createKitchenAlertPlayer({
  createContext,
  windowObject = globalThis.window,
  defaultProfile = ADMIN_KITCHEN_ALERT_DEFAULTS.profile,
  defaultVolume = ADMIN_KITCHEN_ALERT_DEFAULTS.volume,
} = {}) {
  let context

  const getContext = () => {
    if (context === undefined) {
      context = createContext ? createContext() : defaultCreateContext(windowObject)
    }
    return context
  }

  const unlock = async () => {
    try {
      const current = getContext()
      if (!current || current.state === 'closed') return false
      if (current.state === 'suspended') await current.resume()
      return current.state !== 'suspended' && current.state !== 'closed'
    } catch {
      return false
    }
  }

  const play = async ({ profile, volume } = {}) => {
    if (!await unlock()) return false
    try {
      const current = getContext()
      const selectedProfile = getKitchenAlertProfile(profile, defaultProfile)
      const selectedVolume = getKitchenAlertVolume(volume, defaultVolume)
      const anchor = current.currentTime + 0.02

      for (const tone of selectedProfile.tones) {
        const oscillator = current.createOscillator()
        const gain = current.createGain()
        const startsAt = anchor + tone.start
        const endsAt = startsAt + tone.duration
        const attack = Math.min(0.025, Math.max(0.008, tone.duration * 0.12))
        const peak = Math.max(0.001, Math.min(0.36, tone.gain * selectedVolume.scale))

        oscillator.type = tone.type
        oscillator.frequency.setValueAtTime(tone.frequency, startsAt)
        gain.gain.setValueAtTime(0.0001, startsAt)
        if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
          gain.gain.exponentialRampToValueAtTime(peak, startsAt + attack)
          gain.gain.exponentialRampToValueAtTime(0.0001, endsAt)
        } else {
          gain.gain.setValueAtTime(peak, startsAt + attack)
          gain.gain.setValueAtTime(0.0001, endsAt)
        }
        oscillator.connect(gain)
        gain.connect(current.destination)
        oscillator.start(startsAt)
        oscillator.stop(endsAt + 0.02)
      }
      return true
    } catch {
      return false
    }
  }

  const close = async () => {
    try {
      if (context?.close) await context.close()
    } finally {
      context = undefined
    }
  }

  return Object.freeze({ unlock, play, close })
}
