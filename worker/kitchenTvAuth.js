const TOKEN_BYTES = 32
const PAIRING_TTL_MS = 30 * 60 * 1000
const KITCHEN_TV_COOKIE_NAME = 'kitchen_tv_session'
const KITCHEN_TV_SESSION_MAX_AGE_SECONDS = 180 * 24 * 60 * 60
const encoder = new TextEncoder()

const bytesToBase64Url = (bytes) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const bytesToHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

export const createKitchenTvToken = (cryptoApi = crypto) => {
  const bytes = new Uint8Array(TOKEN_BYTES)
  cryptoApi.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

export const hashKitchenTvToken = async (token) => {
  if (typeof token !== 'string' || !token.length) throw new TypeError('Kitchen TV token must be a non-empty string')
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token))
  return bytesToHex(new Uint8Array(digest))
}

export const createKitchenTvCredential = async (cryptoApi = crypto) => {
  const token = createKitchenTvToken(cryptoApi)
  return { token, tokenHash: await hashKitchenTvToken(token) }
}

export const kitchenTvPairingExpiresAt = (now = new Date()) => new Date(now.getTime() + PAIRING_TTL_MS)

export const kitchenTvSessionCookie = (token, maxAgeSeconds = KITCHEN_TV_SESSION_MAX_AGE_SECONDS) =>
  `${KITCHEN_TV_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`

export const clearKitchenTvSessionCookie = () =>
  `${KITCHEN_TV_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`

export const readKitchenTvSessionToken = (request) => {
  const header = request.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=')
    if (rawName === KITCHEN_TV_COOKIE_NAME) return rawValue.join('=') || null
  }
  return null
}

export const KITCHEN_TV_SESSION_MAX_AGE = KITCHEN_TV_SESSION_MAX_AGE_SECONDS
