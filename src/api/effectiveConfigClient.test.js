import assert from 'node:assert/strict'
import test from 'node:test'
import { getEffectiveConfig } from './effectiveConfigClient.js'

const jsonResponse = (payload) => ({ ok: true, status: 200, json: async () => payload })

test('effective config client preserves the existing optional knownVersion query encoding', { concurrency: false }, async (t) => {
  const calls = []
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async (path) => {
    calls.push(String(path))
    return jsonResponse({ effectiveConfigVersion: 'opaque/version' })
  }
  assert.deepEqual(await getEffectiveConfig(), { effectiveConfigVersion: 'opaque/version' })
  assert.deepEqual(await getEffectiveConfig('opaque/version'), { effectiveConfigVersion: 'opaque/version' })
  assert.deepEqual(calls, ['/api/settings/effective', '/api/settings/effective?knownVersion=opaque%2Fversion'])
})
