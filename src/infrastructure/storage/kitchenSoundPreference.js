import {
  ADMIN_KITCHEN_ALERT_DEFAULTS,
  getKitchenAlertProfile,
  getKitchenAlertVolume,
} from '../../shared/utils/kitchenAlertCatalog.js'

export const KITCHEN_SOUND_STORAGE_KEY = 'kitchen-sound-enabled'
export const KITCHEN_SOUND_PROFILE_STORAGE_KEY = 'kitchen-sound-profile'
export const KITCHEN_SOUND_VOLUME_STORAGE_KEY = 'kitchen-sound-volume'

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

export const readKitchenSoundProfilePreference = (
  storage = browserStorage(),
  fallback = ADMIN_KITCHEN_ALERT_DEFAULTS.profile,
) => {
  try {
    return getKitchenAlertProfile(storage?.getItem(KITCHEN_SOUND_PROFILE_STORAGE_KEY), fallback).id
  } catch {
    return getKitchenAlertProfile(fallback).id
  }
}

export const writeKitchenSoundProfilePreference = (profile, storage = browserStorage()) => {
  if (!storage?.setItem) throw new Error('Browser storage unavailable.')
  storage.setItem(KITCHEN_SOUND_PROFILE_STORAGE_KEY, getKitchenAlertProfile(profile).id)
}

export const readKitchenSoundVolumePreference = (
  storage = browserStorage(),
  fallback = ADMIN_KITCHEN_ALERT_DEFAULTS.volume,
) => {
  try {
    return getKitchenAlertVolume(storage?.getItem(KITCHEN_SOUND_VOLUME_STORAGE_KEY), fallback).id
  } catch {
    return getKitchenAlertVolume(fallback).id
  }
}

export const writeKitchenSoundVolumePreference = (volume, storage = browserStorage()) => {
  if (!storage?.setItem) throw new Error('Browser storage unavailable.')
  storage.setItem(KITCHEN_SOUND_VOLUME_STORAGE_KEY, getKitchenAlertVolume(volume).id)
}
