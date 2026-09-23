import assert from 'node:assert/strict'
import test from 'node:test'

const authPromise = import('./kitchenTvAuth.js').catch(() => ({}))

test('creates a URL-safe opaque token and a six-digit pairing code', async () => {
  const auth = await authPromise
  let requestedBytes = 0
  const tokenCrypto = { getRandomValues(bytes) {
    requestedBytes = bytes.length
    bytes.set(Array.from({ length: bytes.length }, (_, index) => index))
    return bytes
  } }
  const token = auth.createKitchenTvToken(tokenCrypto)
  assert.equal(requestedBytes, 32)
  assert.equal(token, 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8')
  assert.doesNotMatch(token, /[+/=]/)

  const code = auth.createKitchenTvPairingCode({ getRandomValues(values) { values[0] = 482731; return values } })
  assert.equal(code, '482731')
  assert.match(code, /^\d{6}$/)
})

test('hashes Kitchen TV secrets with deterministic SHA-256 without preserving plaintext', async () => {
  const auth = await authPromise
  assert.equal(await auth.hashKitchenTvToken('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  const credential = await auth.createKitchenTvCredential({ getRandomValues(bytes) { bytes.fill(7); return bytes } })
  assert.equal(credential.token.includes(credential.tokenHash), false)
  assert.equal(credential.tokenHash.length, 64)
})

test('uses separate secure cookies for pending pairing and the long-lived TV session', async () => {
  const auth = await authPromise
  const session = auth.kitchenTvSessionCookie('session-token')
  const pairing = auth.kitchenTvPairingRequestCookie('request-token')
  assert.match(session, /^kitchen_tv_session=session-token;/)
  assert.match(pairing, /^kitchen_tv_pairing_request=request-token;/)
  for (const cookie of [session, pairing]) {
    assert.match(cookie, /HttpOnly/)
    assert.match(cookie, /Secure/)
    assert.match(cookie, /SameSite=Strict/)
    assert.match(cookie, /Path=\//)
  }
  assert.match(session, /Max-Age=15552000/)
  assert.match(pairing, /Max-Age=1800/)
  assert.match(auth.clearKitchenTvPairingRequestCookie(), /Max-Age=0/)
})

test('cookie readers never confuse admin, pending-pairing and final-TV cookies', async () => {
  const auth = await authPromise
  const request = new Request('https://delivery.example/cozinha-tv', {
    headers: { cookie: 'amor_session=admin; kitchen_tv_pairing_request=pending; kitchen_tv_session=tv' },
  })
  assert.equal(auth.readKitchenTvPairingRequestToken(request), 'pending')
  assert.equal(auth.readKitchenTvSessionToken(request), 'tv')
  assert.equal(auth.readKitchenTvSessionToken(new Request('https://delivery.example', { headers: { cookie: 'amor_session=admin' } })), null)
})

test('pairing requests expire exactly thirty minutes after issue', async () => {
  const auth = await authPromise
  const now = new Date('2026-09-22T18:00:00.000Z')
  assert.equal(auth.kitchenTvPairingExpiresAt(now).toISOString(), '2026-09-22T18:30:00.000Z')
})
