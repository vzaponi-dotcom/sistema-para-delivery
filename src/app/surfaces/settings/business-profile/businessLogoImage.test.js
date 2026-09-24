import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BUSINESS_LOGO_MAX_BYTES,
  createBusinessLogoPreviewOwner,
  normalizeBusinessLogo,
} from './businessLogoImage.js'

const sha256 = async (blob) => {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

test('normalizes supported images to bounded WebP with preserved aspect ratio, size cap and SHA-256', async () => {
  const input = new Blob(['source'], { type: 'image/png' })
  const encodeCalls = []
  let closed = 0
  const oversized = new Blob([new Uint8Array(BUSINESS_LOGO_MAX_BYTES + 1)], { type: 'image/webp' })
  const finalBlob = new Blob(['normalized-webp'], { type: 'image/webp' })

  const result = await normalizeBusinessLogo(input, {
    decodeImage: async () => ({ source: { tag: 'decoded' }, width: 2400, height: 1200, close: () => { closed += 1 } }),
    encodeWebp: async (_source, options) => {
      encodeCalls.push(options)
      return encodeCalls.length === 1 ? oversized : finalBlob
    },
  })

  assert.equal(encodeCalls[0].width, 1024)
  assert.equal(encodeCalls[0].height, 512)
  assert.equal(encodeCalls.every(({ width, height }) => Math.max(width, height) <= 1024), true)
  assert.equal(result.blob, finalBlob)
  assert.equal(result.contentType, 'image/webp')
  assert.equal(result.width, encodeCalls.at(-1).width)
  assert.equal(result.height, encodeCalls.at(-1).height)
  assert.equal(result.sizeBytes <= BUSINESS_LOGO_MAX_BYTES, true)
  assert.equal(result.sha256, await sha256(finalBlob))
  assert.equal(closed, 1)
})

test('rejects unsupported types and decode failures before any upload-ready result exists', async () => {
  let decoded = false
  await assert.rejects(
    () => normalizeBusinessLogo(new Blob(['svg'], { type: 'image/svg+xml' }), {
      decodeImage: async () => { decoded = true; return { width: 1, height: 1 } },
      encodeWebp: async () => new Blob(['x'], { type: 'image/webp' }),
    }),
    { code: 'BUSINESS_LOGO_INVALID' },
  )
  assert.equal(decoded, false)

  await assert.rejects(
    () => normalizeBusinessLogo(new Blob(['broken'], { type: 'image/jpeg' }), {
      decodeImage: async () => { throw new Error('decode failed') },
      encodeWebp: async () => new Blob(['x'], { type: 'image/webp' }),
    }),
    { code: 'BUSINESS_LOGO_INVALID' },
  )
})

test('preview owner revokes replaced and disposed object URLs', () => {
  const revoked = []
  let sequence = 0
  const owner = createBusinessLogoPreviewOwner({
    createObjectURL: () => `blob:preview-${++sequence}`,
    revokeObjectURL: (url) => revoked.push(url),
  })

  assert.equal(owner.replace(new Blob(['a'])), 'blob:preview-1')
  assert.equal(owner.replace(new Blob(['b'])), 'blob:preview-2')
  assert.deepEqual(revoked, ['blob:preview-1'])
  owner.dispose()
  assert.deepEqual(revoked, ['blob:preview-1', 'blob:preview-2'])
  assert.equal(owner.current(), null)
})
