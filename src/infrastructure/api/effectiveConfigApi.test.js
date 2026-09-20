import test from 'node:test'
import assert from 'node:assert/strict'
import { createEffectiveConfigApi, getEffectiveConfig } from './effectiveConfigApi.js'

test('effective-config API preserves the optional knownVersion query', async () => {
  const calls = []
  const api = createEffectiveConfigApi({
    request: async (path) => {
      calls.push(path)
      return { effectiveConfigVersion: 'opaque/version' }
    },
  })

  assert.deepEqual(await api.getEffectiveConfig(), { effectiveConfigVersion: 'opaque/version' })
  assert.deepEqual(await api.getEffectiveConfig('opaque/version'), { effectiveConfigVersion: 'opaque/version' })
  assert.deepEqual(calls, [
    '/api/settings/effective',
    '/api/settings/effective?knownVersion=opaque%2Fversion',
  ])
})

test('default effective-config API preserves HTTP status/code/message semantics', { concurrency: false }, async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: 'UNAUTHENTICATED', message: 'Sessão expirada' },
  }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  })

  await assert.rejects(() => getEffectiveConfig(), (error) => {
    assert.equal(error.status, 401)
    assert.equal(error.code, 'UNAUTHENTICATED')
    assert.equal(error.message, 'Sessão expirada')
    return true
  })
})
