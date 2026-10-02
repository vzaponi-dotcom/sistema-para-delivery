import test from 'node:test'
import assert from 'node:assert/strict'
import { createContextHttpClient } from './contextHttpClient.js'

test('retained client captures the source context for JSON, HTML, blobs and multipart', async () => {
  const context = { contextId: 'context-A' }
  const requests = []
  const client = createContextHttpClient({ context, fetchImpl: async (path, options) => {
    requests.push({ path, options })
    return path === '/json' || path === '/form' ? Response.json({ ok: true }) : new Response('document')
  } })
  context.contextId = 'context-B'
  await client.request('/json', { headers: new Headers({ 'x-extra': 'value', 'X-Mesiva-Context': 'context-B' }) })
  await client.text('/html')
  await client.blob('/image')
  const form = new FormData(); form.set('name', 'A')
  await client.request('/form', { method: 'PUT', body: form })
  for (const { options } of requests) {
    assert.equal(new Headers(options.headers).get('X-Mesiva-Context'), 'context-A')
    assert.equal(options.credentials, 'same-origin')
  }
  assert.equal(new Headers(requests[0].options.headers).get('x-extra'), 'value')
  assert.equal(new Headers(requests[3].options.headers).has('content-type'), false)
})

test('context conflict invalidates once and never retries a mutation', async () => {
  let calls = 0, invalidations = 0
  const client = createContextHttpClient({ context: { contextId: 'A' }, onContextChanged: () => { invalidations++ }, fetchImpl: async () => {
    calls++; return Response.json({ error: { code: 'SESSION_CONTEXT_CHANGED', message: 'Context changed' } }, { status: 409 })
  } })
  await assert.rejects(client.request('/api/orders', { method: 'POST', body: '{}' }), { status: 409, code: 'SESSION_CONTEXT_CHANGED' })
  assert.equal(calls, 1); assert.equal(invalidations, 1)
})
