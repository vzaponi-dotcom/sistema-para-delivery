const encoder = new TextEncoder()
const PIN_ALGORITHM = 'pbkdf2-sha256'
// Cloudflare Workers Web Crypto rejects PBKDF2 iteration counts above 100,000.
const PIN_ITERATIONS = 100000
const PIN_SALT_BYTES = 16
const PIN_KEY_BYTES = 32
const SESSION_COOKIE_NAME = 'amor_session'
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

const bytesToBase64 = (bytes) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const base64ToBytes = (value) => {
  try {
    const binary = atob(value)
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    return null
  }
}

const bytesToBase64Url = (bytes) => bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

const bytesToHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

const sha256Hex = async (value) => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return bytesToHex(new Uint8Array(digest))
}

const derivePin = async (pin, saltBytes, iterations = PIN_ITERATIONS) => {
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    keyMaterial,
    PIN_KEY_BYTES * 8,
  )
  return new Uint8Array(bits)
}

const constantTimeEqual = (left, right) => {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index] ^ right[index]
  return mismatch === 0
}

const cookieValue = (request, name) => {
  const header = request.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=')
    if (rawName === name) return rawValue.join('=') || null
  }
  return null
}

export const hashPin = async (pin, saltBytes = crypto.getRandomValues(new Uint8Array(PIN_SALT_BYTES))) => {
  if (typeof pin !== 'string' || !pin.length) throw new TypeError('PIN must be a non-empty string')
  if (!(saltBytes instanceof Uint8Array) || saltBytes.length !== PIN_SALT_BYTES) {
    throw new TypeError(`PBKDF2 salt must be exactly ${PIN_SALT_BYTES} bytes`)
  }

  const derived = await derivePin(pin, saltBytes)
  return `${PIN_ALGORITHM}$${PIN_ITERATIONS}$${bytesToBase64(saltBytes)}$${bytesToBase64(derived)}`
}

export const verifyPin = async (pin, verifier) => {
  if (typeof pin !== 'string' || typeof verifier !== 'string') return false
  const [algorithm, iterationsText, saltText, expectedText, ...extra] = verifier.split('$')
  if (extra.length || algorithm !== PIN_ALGORITHM || iterationsText !== String(PIN_ITERATIONS) || !saltText || !expectedText) return false

  const salt = base64ToBytes(saltText)
  const expected = base64ToBytes(expectedText)
  if (!salt || salt.length !== PIN_SALT_BYTES || !expected || expected.length !== PIN_KEY_BYTES) return false

  try {
    const actual = await derivePin(pin, salt, PIN_ITERATIONS)
    return constantTimeEqual(actual, expected)
  } catch {
    return false
  }
}

export const sessionCookie = (token, maxAgeSeconds = SESSION_MAX_AGE_SECONDS) =>
  `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`

export const clearSessionCookie = () =>
  `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`

export const createSession = async (env, businessId, now = new Date()) => {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32))
  const token = bytesToBase64Url(tokenBytes)
  const tokenHash = await sha256Hex(token)
  const id = crypto.randomUUID()
  const createdAt = now.toISOString()
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000).toISOString()

  await env.DB.prepare(
    `INSERT INTO sessions (id, business_id, token_hash, created_at, expires_at, last_seen_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  ).bind(id, businessId, tokenHash, createdAt, expiresAt, createdAt).run()

  return { token, expiresAt }
}

export const getAuthenticatedSession = async (request, env, now = new Date()) => {
  const token = cookieValue(request, SESSION_COOKIE_NAME)
  if (!token) return null

  const tokenHash = await sha256Hex(token)
  const row = await env.DB.prepare(
    `SELECT id, business_id, expires_at, revoked_at
     FROM sessions
     WHERE token_hash = ?
     LIMIT 1`,
  ).bind(tokenHash).first()

  if (!row || row.revoked_at || !row.expires_at || new Date(row.expires_at).getTime() <= now.getTime()) return null

  const lastSeenAt = now.toISOString()
  await env.DB.prepare(
    `UPDATE sessions SET last_seen_at = ? WHERE id = ? AND business_id = ?`,
  ).bind(lastSeenAt, row.id, row.business_id).run()

  return { businessId: row.business_id, sessionId: row.id }
}

export const revokeSession = async (request, env, now = new Date()) => {
  const token = cookieValue(request, SESSION_COOKIE_NAME)
  if (!token) return

  const tokenHash = await sha256Hex(token)
  await env.DB.prepare(
    `UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`,
  ).bind(now.toISOString(), tokenHash).run()
}

export const SESSION_MAX_AGE = SESSION_MAX_AGE_SECONDS
