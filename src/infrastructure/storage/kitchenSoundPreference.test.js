import test from 'node:test'
import assert from 'node:assert/strict'
import {
  KITCHEN_SOUND_PROFILE_STORAGE_KEY,
  KITCHEN_SOUND_STORAGE_KEY,
  KITCHEN_SOUND_VOLUME_STORAGE_KEY,
  readKitchenSoundPreference,
  readKitchenSoundProfilePreference,
  readKitchenSoundVolumePreference,
  writeKitchenSoundPreference,
  writeKitchenSoundProfilePreference,
  writeKitchenSoundVolumePreference,
} from './kitchenSoundPreference.js'

const makeStorage = () => {
  const values = new Map()
  return {
    values,
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  }
}

test('kitchen sound preference preserves the existing boolean key and serialization', () => {
  const { storage, values } = makeStorage()

  assert.equal(KITCHEN_SOUND_STORAGE_KEY, 'kitchen-sound-enabled')
  assert.equal(readKitchenSoundPreference(storage), true)
  writeKitchenSoundPreference(false, storage)
  assert.equal(values.get(KITCHEN_SOUND_STORAGE_KEY), 'false')
  assert.equal(readKitchenSoundPreference(storage), false)
  writeKitchenSoundPreference(true, storage)
  assert.equal(readKitchenSoundPreference(storage), true)
})

test('kitchen alert profile and volume persist with safe Admin defaults', () => {
  const { storage, values } = makeStorage()

  assert.equal(KITCHEN_SOUND_PROFILE_STORAGE_KEY, 'kitchen-sound-profile')
  assert.equal(KITCHEN_SOUND_VOLUME_STORAGE_KEY, 'kitchen-sound-volume')
  assert.equal(readKitchenSoundProfilePreference(storage), 'bell')
  assert.equal(readKitchenSoundVolumePreference(storage), 'high')

  writeKitchenSoundProfilePreference('kitchen-strong', storage)
  writeKitchenSoundVolumePreference('max', storage)
  assert.equal(values.get(KITCHEN_SOUND_PROFILE_STORAGE_KEY), 'kitchen-strong')
  assert.equal(values.get(KITCHEN_SOUND_VOLUME_STORAGE_KEY), 'max')
  assert.equal(readKitchenSoundProfilePreference(storage), 'kitchen-strong')
  assert.equal(readKitchenSoundVolumePreference(storage), 'max')
})

test('Kitchen TV may supply different first-use fallbacks while persisted values remain authoritative', () => {
  const { storage } = makeStorage()

  assert.equal(readKitchenSoundProfilePreference(storage, 'kitchen-strong'), 'kitchen-strong')
  assert.equal(readKitchenSoundVolumePreference(storage, 'max'), 'max')

  writeKitchenSoundProfilePreference('double-alert', storage)
  writeKitchenSoundVolumePreference('normal', storage)
  assert.equal(readKitchenSoundProfilePreference(storage, 'kitchen-strong'), 'double-alert')
  assert.equal(readKitchenSoundVolumePreference(storage, 'max'), 'normal')
})

test('invalid stored profile and volume normalize to the supplied fallback', () => {
  const { storage, values } = makeStorage()
  values.set(KITCHEN_SOUND_PROFILE_STORAGE_KEY, 'broken')
  values.set(KITCHEN_SOUND_VOLUME_STORAGE_KEY, 'broken')

  assert.equal(readKitchenSoundProfilePreference(storage), 'bell')
  assert.equal(readKitchenSoundVolumePreference(storage), 'high')
  assert.equal(readKitchenSoundProfilePreference(storage, 'kitchen-strong'), 'kitchen-strong')
  assert.equal(readKitchenSoundVolumePreference(storage, 'max'), 'max')
})

test('kitchen sound preferences are safe when browser storage is absent or throws', () => {
  assert.equal(readKitchenSoundPreference(undefined), true)
  assert.equal(readKitchenSoundPreference({ getItem: () => { throw new Error('blocked') } }), true)
  assert.equal(readKitchenSoundProfilePreference({ getItem: () => { throw new Error('blocked') } }), 'bell')
  assert.equal(readKitchenSoundVolumePreference({ getItem: () => { throw new Error('blocked') } }), 'high')
  assert.throws(() => writeKitchenSoundPreference(true, undefined), /unavailable/i)
  assert.throws(() => writeKitchenSoundProfilePreference('bell', undefined), /unavailable/i)
  assert.throws(() => writeKitchenSoundVolumePreference('high', undefined), /unavailable/i)
  assert.throws(() => writeKitchenSoundPreference(true, { setItem: () => { throw new Error('blocked') } }), /blocked/)
})
