import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEVICE_PREFERENCES_UPDATED_AT_KEY,
  formatDeviceTimestamp,
  formatStorageUsage,
  getBrowserLabel,
  getLocalStorageUsageBytes,
  readDevicePreferencesUpdatedAt,
  writeDevicePreferencesUpdatedAt,
} from './devicePreferences.js'

test('keeps device preference metadata under the established storage key', () => {
  const writes = []
  const storage = { setItem(key, value) { writes.push([key, value]) } }

  writeDevicePreferencesUpdatedAt(storage, '2026-09-16T12:34:56.000Z')

  assert.equal(DEVICE_PREFERENCES_UPDATED_AT_KEY, 'delivery-device-preferences-updated-at')
  assert.deepEqual(writes, [['delivery-device-preferences-updated-at', '2026-09-16T12:34:56.000Z']])
})

test('labels supported browsers and falls back to the current browser label', () => {
  assert.equal(getBrowserLabel('Mozilla/5.0 Edg/140.0.0.0'), 'Microsoft Edge 140')
  assert.equal(getBrowserLabel('Mozilla/5.0 OPR/121.0.0.0'), 'Opera 121')
  assert.equal(getBrowserLabel('Mozilla/5.0 Firefox/142.0'), 'Mozilla Firefox 142')
  assert.equal(getBrowserLabel('Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36'), 'Google Chrome 140')
  assert.equal(getBrowserLabel('Mozilla/5.0 Version/18.6 Safari/605.1.15'), 'Safari 18')
  assert.equal(getBrowserLabel('test'), 'Navegador atual')
})

test('reads timestamp metadata best-effort and measures browser storage in UTF-16 bytes', () => {
  const storage = {
    length: 2,
    key(index) { return ['tema', 'som'][index] ?? null },
    getItem(key) { return { tema: 'escuro', som: 'ativo' }[key] ?? null },
  }

  assert.equal(readDevicePreferencesUpdatedAt({ getItem: () => '2026-09-16T12:34:56.000Z' }), '2026-09-16T12:34:56.000Z')
  assert.equal(readDevicePreferencesUpdatedAt({ getItem() { throw new Error('blocked') } }), '')
  assert.equal(getLocalStorageUsageBytes(storage), 36)
  assert.equal(getLocalStorageUsageBytes({ get length() { throw new Error('blocked') } }), null)
})

test('formats unavailable storage, bytes, kilobytes, and invalid timestamps with the established copy', () => {
  assert.equal(formatStorageUsage(null), 'Indisponível')
  assert.equal(formatStorageUsage(1023), '1023 B')
  assert.equal(formatStorageUsage(1024), '1.0 KB')
  assert.equal(formatStorageUsage(10240), '10 KB')
  assert.equal(formatDeviceTimestamp(''), 'Ainda não registrada')
  assert.equal(formatDeviceTimestamp('not-a-date'), 'Ainda não registrada')
})
