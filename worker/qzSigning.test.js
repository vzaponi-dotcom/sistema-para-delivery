import assert from 'node:assert/strict'
import test from 'node:test'
import { getConfiguredQzCertificate, signQzPayload } from './qzSigning.js'

const bytesToPem = (bytes, label) => {
  const base64 = Buffer.from(bytes).toString('base64')
  const lines = base64.match(/.{1,64}/g) || []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

const createTestKeyPair = async () => {
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
  return {
    privatePem: bytesToPem(new Uint8Array(privatePkcs8), 'PRIVATE KEY'),
    publicKey: keys.publicKey,
  }
}

test('configured QZ certificate is returned verbatim after trimming outer whitespace', () => {
  const certificate = '-----BEGIN CERTIFICATE-----\nTEST CERTIFICATE\n-----END CERTIFICATE-----'
  assert.equal(getConfiguredQzCertificate({ QZ_DIGITAL_CERTIFICATE: `\n${certificate}\n` }), certificate)
})

test('missing QZ certificate is a controlled configuration error', () => {
  assert.throws(
    () => getConfiguredQzCertificate({}),
    (error) => error.status === 503 && error.code === 'QZ_SIGNING_UNAVAILABLE',
  )
})

test('signQzPayload returns a SHA-512 RSA signature that verifies', async () => {
  const { privatePem, publicKey } = await createTestKeyPair()
  const payload = 'call=print&timestamp=123'
  const signature = await signQzPayload({ QZ_SIGNING_PRIVATE_KEY: privatePem }, payload)
  const signatureBytes = Uint8Array.from(Buffer.from(signature, 'base64'))

  const verified = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    publicKey,
    signatureBytes,
    new TextEncoder().encode(payload),
  )

  assert.equal(verified, true)
})

test('missing QZ signing key is a controlled configuration error', async () => {
  await assert.rejects(
    () => signQzPayload({}, 'payload'),
    (error) => error.status === 503 && error.code === 'QZ_SIGNING_UNAVAILABLE',
  )
})

test('blank and oversized QZ signing payloads are rejected', async () => {
  const { privatePem } = await createTestKeyPair()
  const env = { QZ_SIGNING_PRIVATE_KEY: privatePem }

  await assert.rejects(
    () => signQzPayload(env, '   '),
    (error) => error.status === 400 && error.code === 'INVALID_QZ_SIGN_PAYLOAD',
  )

  const oversized = 'a'.repeat(1_048_577)
  await assert.rejects(
    () => signQzPayload(env, oversized),
    (error) => error.status === 400 && error.code === 'INVALID_QZ_SIGN_PAYLOAD',
  )
})
