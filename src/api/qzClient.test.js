import test from 'node:test'
import assert from 'node:assert/strict'
import { getQzCertificate, signQzPayload } from './client.js'

const withFetch = async (implementation, callback) => {
  const original = globalThis.fetch
  globalThis.fetch = implementation
  try {
    await callback()
  } finally {
    globalThis.fetch = original
  }
}

test('QZ certificate helper returns the authenticated plain-text certificate', async () => {
  let call
  await withFetch(async (...args) => {
    call = args
    return new Response('CERTIFICATE TEXT', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })
  }, async () => {
    assert.equal(await getQzCertificate(), 'CERTIFICATE TEXT')
  })

  assert.equal(call[0], '/api/printing/qz/certificate')
  assert.equal(call[1].credentials, 'same-origin')
})

test('QZ signing helper posts toSign and returns the plain-text signature', async () => {
  let call
  await withFetch(async (...args) => {
    call = args
    return new Response('BASE64SIGNATURE==', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })
  }, async () => {
    assert.equal(await signQzPayload('call=print&timestamp=123'), 'BASE64SIGNATURE==')
  })

  assert.equal(call[0], '/api/printing/qz/sign')
  assert.equal(call[1].method, 'POST')
  assert.equal(call[1].credentials, 'same-origin')
  assert.equal(call[1].headers['content-type'], 'application/json')
  assert.deepEqual(JSON.parse(call[1].body), { toSign: 'call=print&timestamp=123' })
})

test('QZ plain-text helpers preserve structured JSON API errors', async () => {
  await withFetch(async () => new Response(JSON.stringify({ error: { code: 'QZ_SIGNING_UNAVAILABLE', message: 'Assinatura QZ indisponível' } }), {
    status: 503,
    headers: { 'content-type': 'application/json' },
  }), async () => {
    await assert.rejects(() => getQzCertificate(), (error) => {
      assert.equal(error.status, 503)
      assert.equal(error.code, 'QZ_SIGNING_UNAVAILABLE')
      assert.equal(error.message, 'Assinatura QZ indisponível')
      return true
    })
  })
})
