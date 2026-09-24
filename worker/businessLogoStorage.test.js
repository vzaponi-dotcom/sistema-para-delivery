import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BUSINESS_LOGO_MAX_BYTES,
  deleteBusinessLogo,
  readBusinessLogo,
  storeBusinessLogo,
  validateBusinessLogo,
} from './businessLogoStorage.js'

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
])
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
const WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
])
const GIF = new TextEncoder().encode('GIF89a fake')
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
const RANDOM = Uint8Array.from([1, 2, 3, 4, 5, 6])

const sha256 = async (bytes) => {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

class FakeBucket {
  constructor() {
    this.objects = new Map()
    this.puts = []
    this.deletes = []
    this.failPut = false
    this.failGet = false
    this.failDelete = false
  }

  async put(key, bytes, options) {
    if (this.failPut) throw new Error('put unavailable')
    const body = new Uint8Array(bytes)
    this.puts.push({ key, body, options })
    this.objects.set(key, {
      key,
      body,
      httpMetadata: options?.httpMetadata || {},
      etag: `etag-${this.puts.length}`,
    })
    return { key, etag: `etag-${this.puts.length}` }
  }

  async get(key) {
    if (this.failGet) throw new Error('get unavailable')
    const found = this.objects.get(key)
    if (!found) return null
    return {
      key,
      etag: found.etag,
      httpMetadata: found.httpMetadata,
      arrayBuffer: async () => found.body.slice().buffer,
    }
  }

  async delete(key) {
    this.deletes.push(key)
    if (this.failDelete) throw new Error('delete unavailable')
    this.objects.delete(key)
  }
}

test('validates PNG, JPEG and WebP by MIME plus magic bytes and returns canonical metadata', async () => {
  for (const [bytes, contentType] of [
    [PNG, 'image/png'],
    [JPEG, 'image/jpeg'],
    [WEBP, 'image/webp'],
  ]) {
    const logo = await validateBusinessLogo(bytes, contentType)
    assert.equal(logo.contentType, contentType)
    assert.equal(logo.sizeBytes, bytes.byteLength)
    assert.equal(logo.sha256, await sha256(bytes))
    assert.deepEqual([...logo.bytes], [...bytes])
  }
})

test('rejects unsupported MIME, mismatched signatures, active formats and arbitrary bytes', async () => {
  for (const [bytes, contentType] of [
    [PNG, 'image/jpeg'],
    [JPEG, 'image/webp'],
    [WEBP, 'image/png'],
    [GIF, 'image/gif'],
    [SVG, 'image/svg+xml'],
    [RANDOM, 'image/webp'],
    [RANDOM, 'application/octet-stream'],
  ]) {
    await assert.rejects(validateBusinessLogo(bytes, contentType), {
      status: 400,
      code: 'BUSINESS_LOGO_INVALID',
    })
  }
})

test('rejects empty and oversized logos before hashing or storage', async () => {
  await assert.rejects(validateBusinessLogo(new Uint8Array(), 'image/webp'), {
    status: 400,
    code: 'BUSINESS_LOGO_INVALID',
  })
  await assert.rejects(validateBusinessLogo(new Uint8Array(BUSINESS_LOGO_MAX_BYTES + 1), 'image/webp'), {
    status: 413,
    code: 'BUSINESS_LOGO_TOO_LARGE',
  })
})

test('store generates an opaque server-side key and writes immutable HTTP metadata', async () => {
  const bucket = new FakeBucket()
  const logo = await validateBusinessLogo(WEBP, 'image/webp')
  const stored = await storeBusinessLogo(bucket, 'amor-e-sabor', { ...logo, objectKey: 'client-controlled.webp' }, {
    createId: () => 'logo-uuid',
    now: () => new Date('2026-09-24T04:00:00.000Z'),
  })

  assert.equal(stored.objectKey, 'businesses/amor-e-sabor/logo/logo-uuid.webp')
  assert.notEqual(stored.objectKey, 'client-controlled.webp')
  assert.equal(stored.contentType, 'image/webp')
  assert.equal(stored.sha256, logo.sha256)
  assert.equal(stored.sizeBytes, WEBP.byteLength)
  assert.equal(stored.updatedAt, '2026-09-24T04:00:00.000Z')
  assert.equal(bucket.puts.length, 1)
  assert.equal(bucket.puts[0].key, stored.objectKey)
  assert.deepEqual(bucket.puts[0].options, { httpMetadata: { contentType: 'image/webp' } })
  assert.deepEqual([...bucket.puts[0].body], [...WEBP])
})

test('generated keys stay scoped to the trusted business and sanitize neither client filenames nor client paths', async () => {
  const bucket = new FakeBucket()
  const logo = await validateBusinessLogo(PNG, 'image/png')
  const stored = await storeBusinessLogo(bucket, 'business-2', {
    ...logo,
    filename: '../../other-business/logo.webp',
    key: 'businesses/other/logo/forged.webp',
  }, { createId: () => 'opaque' })

  assert.equal(stored.objectKey, 'businesses/business-2/logo/opaque.png')
  assert.equal(stored.objectKey.includes('other-business'), false)
})

test('read uses only an internal object key and preserves private object response metadata', async () => {
  const bucket = new FakeBucket()
  const logo = await validateBusinessLogo(JPEG, 'image/jpeg')
  const stored = await storeBusinessLogo(bucket, 'business-1', logo, { createId: () => 'readable' })

  const object = await readBusinessLogo(bucket, stored.objectKey)
  assert.equal(object.key, stored.objectKey)
  assert.equal(object.httpMetadata.contentType, 'image/jpeg')
  assert.ok(object.etag)
  assert.deepEqual([...new Uint8Array(await object.arrayBuffer())], [...JPEG])
  assert.equal(await readBusinessLogo(bucket, 'businesses/business-1/logo/missing.jpg'), null)
})

test('missing or unavailable bucket becomes a functional storage error for reads and writes', async () => {
  const logo = await validateBusinessLogo(WEBP, 'image/webp')

  await assert.rejects(storeBusinessLogo(undefined, 'business-1', logo), {
    status: 503,
    code: 'BUSINESS_LOGO_STORAGE_UNAVAILABLE',
  })
  await assert.rejects(readBusinessLogo(undefined, 'key'), {
    status: 503,
    code: 'BUSINESS_LOGO_STORAGE_UNAVAILABLE',
  })

  const bucket = new FakeBucket()
  bucket.failPut = true
  await assert.rejects(storeBusinessLogo(bucket, 'business-1', logo), {
    status: 503,
    code: 'BUSINESS_LOGO_STORAGE_UNAVAILABLE',
  })
  bucket.failPut = false
  bucket.failGet = true
  await assert.rejects(readBusinessLogo(bucket, 'key'), {
    status: 503,
    code: 'BUSINESS_LOGO_STORAGE_UNAVAILABLE',
  })
})

test('delete is deliberately best-effort and never turns cleanup failure into a second failure', async () => {
  const bucket = new FakeBucket()
  const logo = await validateBusinessLogo(WEBP, 'image/webp')
  const stored = await storeBusinessLogo(bucket, 'business-1', logo, { createId: () => 'delete-me' })

  assert.equal(await deleteBusinessLogo(bucket, stored.objectKey), true)
  assert.equal(bucket.objects.has(stored.objectKey), false)

  bucket.failDelete = true
  assert.equal(await deleteBusinessLogo(bucket, 'stale-key'), false)
  assert.equal(await deleteBusinessLogo(undefined, 'stale-key'), false)
})
