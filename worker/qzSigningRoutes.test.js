import assert from 'node:assert/strict'
import test from 'node:test'
import { handleRequest } from './index.js'
import { handlePrintingApi } from './orderPrintingApi.js'

const bytesToPem = (bytes, label) => {
  const base64 = Buffer.from(bytes).toString('base64')
  const lines = base64.match(/.{1,64}/g) || []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

const createTestPrivateKey = async () => {
  const keys = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-512',
    },
    true,
    ['sign', 'verify'],
  )
  const privatePkcs8 = await crypto.subtle.exportKey('pkcs8', keys.privateKey)
  return bytesToPem(new Uint8Array(privatePkcs8), 'PRIVATE KEY')
}

const route = (path, { method = 'GET', headers = {}, body, env = {} } = {}) => {
  const request = new Request(`https://delivery.example${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return handlePrintingApi(request, env, { businessId: 'amor-e-sabor' }, new URL(request.url))
}

test('QZ certificate endpoint remains protected by the global authenticated API boundary', async () => {
  const response = await handleRequest(
    new Request('https://delivery.example/api/printing/qz/certificate'),
    {},
  )

  assert.equal(response.status, 401)
  assert.equal((await response.json()).error.code, 'UNAUTHENTICATED')
})

test('authenticated QZ certificate route returns plain text without caching', async () => {
  const certificate = '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----'
  const response = await route('/api/printing/qz/certificate', {
    env: { QZ_DIGITAL_CERTIFICATE: certificate },
  })

  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') || '', /^text\/plain/i)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(await response.text(), certificate)
})

test('QZ signing route requires same-origin mutation protection', async () => {
  const response = await route('/api/printing/qz/sign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { toSign: 'payload' },
    env: { QZ_SIGNING_PRIVATE_KEY: await createTestPrivateKey() },
  })

  assert.equal(response.status, 403)
  assert.equal((await response.json()).error.code, 'INVALID_ORIGIN')
})

test('authenticated QZ signing route returns a plain-text Base64 signature without caching', async () => {
  const response = await route('/api/printing/qz/sign', {
    method: 'POST',
    headers: {
      origin: 'https://delivery.example',
      'content-type': 'application/json',
    },
    body: { toSign: 'call=print&timestamp=123' },
    env: { QZ_SIGNING_PRIVATE_KEY: await createTestPrivateKey() },
  })

  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') || '', /^text\/plain/i)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.match(await response.text(), /^[A-Za-z0-9+/]+={0,2}$/)
})

test('QZ certificate route exposes a controlled configuration error instead of secret details', async () => {
  await assert.rejects(
    () => route('/api/printing/qz/certificate'),
    (error) => error.status === 503 && error.code === 'QZ_SIGNING_UNAVAILABLE',
  )
})
