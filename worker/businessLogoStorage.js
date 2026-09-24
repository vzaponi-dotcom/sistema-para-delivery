export const BUSINESS_LOGO_MAX_BYTES = 1024 * 1024

const logoError = (code, status, message, extra = {}) => Object.assign(new Error(message), {
  code,
  status,
  ...extra,
})

const invalid = (message = 'O arquivo de logo é inválido.') => logoError('BUSINESS_LOGO_INVALID', 400, message)
const tooLarge = () => logoError(
  'BUSINESS_LOGO_TOO_LARGE',
  413,
  'O logo deve ter no máximo 1 MiB após o processamento.',
)
const storageUnavailable = (cause) => logoError(
  'BUSINESS_LOGO_STORAGE_UNAVAILABLE',
  503,
  'O armazenamento do logo está indisponível. Tente novamente.',
  { cause },
)

const MIME = Object.freeze({
  'image/png': Object.freeze({ extension: 'png', signature: 'png' }),
  'image/jpeg': Object.freeze({ extension: 'jpg', signature: 'jpeg' }),
  'image/webp': Object.freeze({ extension: 'webp', signature: 'webp' }),
})

const canonicalContentType = (value) => {
  if (typeof value !== 'string') throw invalid()
  const raw = value.split(';', 1)[0].trim().toLocaleLowerCase('en-US')
  if (raw === 'image/jpg') return 'image/jpeg'
  if (!Object.hasOwn(MIME, raw)) throw invalid('Use um arquivo PNG, JPG ou WebP válido.')
  return raw
}

const toBytes = (value) => {
  if (value instanceof Uint8Array) return value.slice()
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0))
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice()
  }
  throw invalid()
}

const startsWith = (bytes, signature) => signature.every((byte, index) => bytes[index] === byte)
const asciiAt = (bytes, offset, text) => [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0))

const validSignature = (bytes, kind) => {
  if (kind === 'png') {
    return bytes.byteLength >= 8 && startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  }
  if (kind === 'jpeg') {
    return bytes.byteLength >= 3 && startsWith(bytes, [0xff, 0xd8, 0xff])
  }
  if (kind === 'webp') {
    return bytes.byteLength >= 12 && asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WEBP')
  }
  return false
}

const sha256Hex = async (bytes) => {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function validateBusinessLogo(value, contentType) {
  const bytes = toBytes(value)
  if (bytes.byteLength === 0) throw invalid()
  if (bytes.byteLength > BUSINESS_LOGO_MAX_BYTES) throw tooLarge()

  const canonical = canonicalContentType(contentType)
  if (!validSignature(bytes, MIME[canonical].signature)) {
    throw invalid('O conteúdo do arquivo não corresponde a uma imagem PNG, JPG ou WebP válida.')
  }

  return Object.freeze({
    bytes,
    contentType: canonical,
    sizeBytes: bytes.byteLength,
    sha256: await sha256Hex(bytes),
  })
}

const requireBucket = (bucket, method) => {
  if (!bucket || typeof bucket[method] !== 'function') throw storageUnavailable()
  return bucket
}

const trustedBusinessSegment = (businessId) => {
  if (typeof businessId !== 'string' || !businessId.trim()) throw invalid('Operação inválida para armazenamento do logo.')
  return encodeURIComponent(businessId.trim())
}

const generatedId = (createId) => {
  const value = createId()
  if (typeof value !== 'string' || !value.trim()) throw storageUnavailable(new Error('Logo object id generation failed.'))
  return encodeURIComponent(value.trim())
}

export async function storeBusinessLogo(bucket, businessId, logo, {
  createId = () => crypto.randomUUID(),
  now = () => new Date(),
} = {}) {
  requireBucket(bucket, 'put')
  const validated = await validateBusinessLogo(logo?.bytes, logo?.contentType)
  const extension = MIME[validated.contentType].extension
  const objectKey = `businesses/${trustedBusinessSegment(businessId)}/logo/${generatedId(createId)}.${extension}`
  const at = now()
  if (!(at instanceof Date) || !Number.isFinite(at.getTime())) throw storageUnavailable(new Error('Logo timestamp generation failed.'))

  try {
    await bucket.put(objectKey, validated.bytes, {
      httpMetadata: { contentType: validated.contentType },
    })
  } catch (cause) {
    throw storageUnavailable(cause)
  }

  return Object.freeze({
    objectKey,
    contentType: validated.contentType,
    sha256: validated.sha256,
    sizeBytes: validated.sizeBytes,
    updatedAt: at.toISOString(),
  })
}

export async function readBusinessLogo(bucket, objectKey) {
  requireBucket(bucket, 'get')
  if (typeof objectKey !== 'string' || !objectKey.trim()) throw invalid('Referência de logo inválida.')

  try {
    return await bucket.get(objectKey)
  } catch (cause) {
    throw storageUnavailable(cause)
  }
}

export async function deleteBusinessLogo(bucket, objectKey) {
  if (!bucket || typeof bucket.delete !== 'function' || typeof objectKey !== 'string' || !objectKey.trim()) return false
  try {
    await bucket.delete(objectKey)
    return true
  } catch {
    return false
  }
}
