import test from 'node:test'
import assert from 'node:assert/strict'
import {
  detectPrintStationPlatform,
  detectPrintStationUiPlatform,
} from './printingPlatform.js'

test('printing platform detection preserves Windows Android iOS and other semantics', () => {
  assert.equal(detectPrintStationPlatform('Mozilla/5.0 (Windows NT 10.0)'), 'windows')
  assert.equal(detectPrintStationPlatform('Mozilla/5.0 (Linux; Android 15)'), 'android')
  assert.equal(detectPrintStationPlatform('Mozilla/5.0 (X11; Linux x86_64)'), 'other')
  assert.equal(detectPrintStationUiPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), 'ios')
  assert.equal(detectPrintStationUiPlatform('Mozilla/5.0 (Windows NT 10.0)'), 'windows')
})
