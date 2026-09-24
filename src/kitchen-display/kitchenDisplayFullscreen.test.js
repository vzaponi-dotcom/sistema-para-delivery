import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isKitchenDisplayFullscreen,
  requestKitchenDisplayFullscreen,
} from './kitchenDisplayFullscreen.js'

test('fullscreen request uses the standard API when available', async () => {
  const calls = []
  const element = {
    requestFullscreen() {
      calls.push('standard')
      return Promise.resolve()
    },
  }
  const doc = { documentElement: element }

  assert.equal(await requestKitchenDisplayFullscreen(doc), true)
  assert.deepEqual(calls, ['standard'])
})

test('fullscreen request falls back to legacy WebKit API used by embedded TV browsers', async () => {
  const calls = []
  const element = {
    webkitRequestFullscreen() {
      calls.push('webkit')
    },
  }
  const doc = { documentElement: element }

  assert.equal(await requestKitchenDisplayFullscreen(doc), true)
  assert.deepEqual(calls, ['webkit'])
})

test('fullscreen request fails soft when unsupported or rejected', async () => {
  assert.equal(await requestKitchenDisplayFullscreen({ documentElement: {} }), false)
  assert.equal(await requestKitchenDisplayFullscreen({
    documentElement: { requestFullscreen: () => Promise.reject(new Error('blocked')) },
  }), false)
})

test('fullscreen state recognizes standard and legacy WebKit document fields', () => {
  assert.equal(isKitchenDisplayFullscreen({ fullscreenElement: {} }), true)
  assert.equal(isKitchenDisplayFullscreen({ webkitFullscreenElement: {} }), true)
  assert.equal(isKitchenDisplayFullscreen({ webkitCurrentFullScreenElement: {} }), true)
  assert.equal(isKitchenDisplayFullscreen({}), false)
})
