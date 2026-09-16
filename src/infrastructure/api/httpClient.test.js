import test from 'node:test'
import assert from 'node:assert/strict'
import { apiRequest, apiTextRequest, withJson } from './httpClient.js'

test('apiRequest preserves same-origin JSON request semantics', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  let captured
  globalThis.fetch = async (path, options) => {
    captured = { path, options }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  assert.deepEqual(await apiRequest('/api/test', withJson('POST', { value: 1 })), { ok: true })
  assert.equal(captured.path, '/api/test')
  assert.equal(captured.options.credentials, 'same-origin')
  assert.equal(captured.options.headers['content-type'], 'application/json')
  assert.equal(captured.options.body, JSON.stringify({ value: 1 }))
})

test('apiRequest preserves error status/code/message', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: 'CONFLICT', message: 'Conflito de teste' },
  }), { status: 409, headers: { 'content-type': 'application/json' } })

  await assert.rejects(
    () => apiRequest('/api/test'),
    (error) => error.status === 409
      && error.code === 'CONFLICT'
      && error.message === 'Conflito de teste',
  )
})

test('apiTextRequest returns successful text payloads', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => new Response('certificate', { status: 200 })
  assert.equal(await apiTextRequest('/api/text'), 'certificate')
})
