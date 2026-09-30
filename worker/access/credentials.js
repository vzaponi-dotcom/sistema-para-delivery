import { apiError } from '../http.js'
import { isBlockedPassword } from './passwordBlocklist.js'

const encoder = new TextEncoder()
const ITERATIONS = 100000
const base64 = (bytes) => btoa(String.fromCharCode(...bytes))
const decode = (text, length) => {
  try {
    const bytes = Uint8Array.from(atob(text), (char) => char.charCodeAt(0))
    return bytes.length === length && base64(bytes) === text ? bytes : null
  } catch { return null }
}
const derive = async (password, salt) => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256))
}

export async function hashHumanPassword(password) {
  if (typeof password !== 'string') throw apiError(400, 'INVALID_PASSWORD', 'Informe uma senha válida.')
  const length = Array.from(password).length
  if (length < 15) throw apiError(400, 'PASSWORD_TOO_SHORT', 'Use uma senha com pelo menos 15 caracteres.')
  if (length > 1024) throw apiError(400, 'PASSWORD_TOO_LONG', 'Use uma senha com até 1024 caracteres.')
  if (isBlockedPassword(password)) throw apiError(400, 'PASSWORD_BLOCKED', 'Escolha uma senha menos comum.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `v1$pbkdf2-sha256$${ITERATIONS}$${base64(salt)}$${base64(await derive(password, salt))}`
}

export async function verifyHumanPassword(password, verifier) {
  if (typeof password !== 'string' || typeof verifier !== 'string' || Array.from(password).length > 1024) return false
  const [version, algorithm, cost, saltText, keyText, ...extra] = verifier.split('$')
  if (version !== 'v1' || algorithm !== 'pbkdf2-sha256' || cost !== String(ITERATIONS) || extra.length) return false
  const salt = decode(saltText, 16)
  const expected = decode(keyText, 32)
  if (!salt || !expected) return false
  const actual = await derive(password, salt)
  let mismatch = 0
  for (let index = 0; index < actual.length; index++) mismatch |= actual[index] ^ expected[index]
  return mismatch === 0
}
