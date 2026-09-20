import test from 'node:test'
import assert from 'node:assert/strict'
import {
  KITCHEN_SOUND_STORAGE_KEY,
  readKitchenSoundPreference,
  writeKitchenSoundPreference,
} from './kitchenSoundPreference.js'

test('kitchen sound preference preserves the key, default and boolean serialization', () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }

  assert.equal(KITCHEN_SOUND_STORAGE_KEY, 'kitchen-sound-enabled')
  assert.equal(readKitchenSoundPreference(storage), true)
  writeKitchenSoundPreference(false, storage)
  assert.equal(values.get(KITCHEN_SOUND_STORAGE_KEY), 'false')
  assert.equal(readKitchenSoundPreference(storage), false)
  writeKitchenSoundPreference(true, storage)
  assert.equal(readKitchenSoundPreference(storage), true)
})

test('kitchen sound preference is safe when browser storage is absent or throws', () => {
  assert.equal(readKitchenSoundPreference(undefined), true)
  assert.equal(readKitchenSoundPreference({ getItem: () => { throw new Error('blocked') } }), true)
  assert.throws(() => writeKitchenSoundPreference(true, undefined), /unavailable/i)
  assert.throws(() => writeKitchenSoundPreference(true, { setItem: () => { throw new Error('blocked') } }), /blocked/)
})
