import test from 'node:test'
import assert from 'node:assert/strict'
import { createBootstrapApi, getBootstrap } from './bootstrapApi.js'

test('bootstrap API preserves the optional effective-config version query', async () => {
  const calls = []
  const api = createBootstrapApi({
    request: async (path) => {
      calls.push(path)
      return { ok: true }
    },
  })

  assert.deepEqual(await api.getBootstrap(), { ok: true })
  assert.deepEqual(await api.getBootstrap('opaque/version'), { ok: true })
  assert.deepEqual(calls, [
    '/api/bootstrap',
    '/api/bootstrap?knownEffectiveConfigVersion=opaque%2Fversion',
  ])
})

test('default bootstrap API preserves HTTP status/code/message semantics', { concurrency: false }, async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: 'UNAUTHENTICATED', message: 'Sessão expirada' },
  }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  })

  await assert.rejects(() => getBootstrap(), (error) => {
    assert.equal(error.status, 401)
    assert.equal(error.code, 'UNAUTHENTICATED')
    assert.equal(error.message, 'Sessão expirada')
    return true
  })
})
