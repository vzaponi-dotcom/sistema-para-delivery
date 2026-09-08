import { apiError } from './http.js'

const QZ_SIGN_MAX_BYTES = 1_048_576

const signingUnavailable = () => apiError(
  503,
  'QZ_SIGNING_UNAVAILABLE',
  'Assinatura QZ não configurada neste ambiente.',
)

const pemToBytes = (pem, label) => {
  const value = String(pem ?? '').trim()
  const begin = `-----BEGIN ${label}-----`
  const end = `-----END ${label}-----`
  if (!value.startsWith(begin) || !value.endsWith(end)) throw signingUnavailable()

  const base64 = value.slice(begin.length, -end.length).replace(/\s+/g, '')
  if (!base64) throw signingUnavailable()

  try {
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  } catch {
    throw signingUnavailable()
  }
}

export const getConfiguredQzCertificate = (env) => {
  const certificate = String(env?.QZ_DIGITAL_CERTIFICATE ?? '').trim()
  if (!certificate) throw signingUnavailable()
  return certificate
}

export const signQzPayload = async (env, toSign) => {
  const payload = String(toSign ?? '')
  const payloadBytes = new TextEncoder().encode(payload)
  if (!payload.trim() || payloadBytes.byteLength > QZ_SIGN_MAX_BYTES) {
    throw apiError(400, 'INVALID_QZ_SIGN_PAYLOAD', 'Payload de assinatura QZ inválido.')
  }

  try {
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      pemToBytes(env?.QZ_SIGNING_PRIVATE_KEY, 'PRIVATE KEY'),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
      false,
      ['sign'],
    )
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      payloadBytes,
    )
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
  } catch (error) {
    if (error?.code === 'QZ_SIGNING_UNAVAILABLE') throw error
    throw signingUnavailable()
  }
}
