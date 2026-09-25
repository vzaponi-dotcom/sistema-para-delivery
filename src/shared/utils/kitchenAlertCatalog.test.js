import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN_KITCHEN_ALERT_DEFAULTS,
  KITCHEN_ALERT_PROFILES,
  KITCHEN_ALERT_VOLUME_OPTIONS,
  TV_KITCHEN_ALERT_DEFAULTS,
  getKitchenAlertProfile,
  getKitchenAlertVolume,
} from './kitchenAlertCatalog.js'

test('kitchen alert catalog exposes five stable profiles and three local volumes', () => {
  assert.deepEqual(KITCHEN_ALERT_PROFILES.map((item) => item.id), [
    'bell',
    'kitchen-strong',
    'double-alert',
    'long-call',
    'classic',
  ])
  assert.deepEqual(KITCHEN_ALERT_VOLUME_OPTIONS.map((item) => item.id), ['normal', 'high', 'max'])
  assert.deepEqual(ADMIN_KITCHEN_ALERT_DEFAULTS, { profile: 'bell', volume: 'high' })
  assert.deepEqual(TV_KITCHEN_ALERT_DEFAULTS, { profile: 'kitchen-strong', volume: 'max' })
})

test('new kitchen profiles are materially longer than the old 160ms TV beep', () => {
  for (const id of ['bell', 'kitchen-strong', 'double-alert', 'long-call']) {
    const profile = getKitchenAlertProfile(id)
    const end = Math.max(...profile.tones.map((tone) => tone.start + tone.duration))
    assert.ok(end >= 0.8, `${id} should remain audible for at least 800ms`)
    assert.ok(profile.tones.length >= 2)
  }
})

test('unknown kitchen alert profile and volume fall back safely', () => {
  assert.equal(getKitchenAlertProfile('unknown').id, 'bell')
  assert.equal(getKitchenAlertVolume('unknown').id, 'high')
  assert.equal(getKitchenAlertProfile('kitchen-strong').label, 'Cozinha forte')
  assert.equal(getKitchenAlertVolume('max').label, 'Máximo')
})
