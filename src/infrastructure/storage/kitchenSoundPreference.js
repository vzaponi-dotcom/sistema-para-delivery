export const KITCHEN_SOUND_STORAGE_KEY = 'kitchen-sound-enabled'

const browserStorage = () => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

export const readKitchenSoundPreference = (storage = browserStorage()) => {
  try {
    return storage?.getItem(KITCHEN_SOUND_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

export const writeKitchenSoundPreference = (enabled, storage = browserStorage()) => {
  if (!storage?.setItem) throw new Error('Browser storage unavailable.')
  storage.setItem(KITCHEN_SOUND_STORAGE_KEY, String(Boolean(enabled)))
}
