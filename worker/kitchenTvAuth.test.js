import assert from 'node:assert/strict'
import test from 'node:test'

const authPromise = import('./kitchenTvAuth.js').catch(() => ({}))

test('creates a 32-byte URL-safe opaque token using the supplied Web Crypto source', async () => {
  const auth = await authPromise
  assert.equal(typeof auth.createKitchenTvToken, 'function')
  let requestedBytes = 0
  const cryptoApi = { getRandomValues(bytes) {
    requestedBytes = bytes.length
    bytes.set(Array.from({ length: bytes.length }, (_, index) => index))
    return bytes
  } }

  const token = auth.createKitchenTvToken(cryptoApi)
  assert.equal(requestedBytes, 32)
  assert.equal(token, 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8')
  assert.doesNotMatch(token, /[+/=]/)
})

test('hashes Kitchen TV secrets with deterministic SHA-256 without preserving plaintext', async () => {
  const auth = await authPromise
  assert.equal(await auth.hashKitchenTvToken('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  const credential = await auth.createKitchenTvCredential({ getRandomValues(bytes) { bytes.fill(7); return bytes } })
  assert.equal(credential.token.includes(credential.tokenHash), false)
  assert.equal(credential.tokenHash.length, 64)
})

test('uses a dedicated secure strict long-lived TV cookie and clears only that cookie', async () => {
  const auth = await authPromise
  const cookie = auth.kitchenTvSessionCookie('opaque-token')
  assert.match(cookie, /^kitchen_tv_session=opaque-token;/)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /SameSite=Strict/)
  assert.match(cookie, /Path=\//)
  assert.match(cookie, /Max-Age=15552000/)
  assert.equal(cookie.includes('amor_session'), false)

  const cleared = auth.clearKitchenTvSessionCookie()
  assert.match(cleared, /^kitchen_tv_session=;/)
  assert.match(cleared, /Max-Age=0/)
  assert.equal(cleared.includes('amor_session'), false)
})

test('reads only the TV cookie and never treats the admin cookie as a TV session', async () => {
  const auth = await authPromise
  const adminOnly = new Request('https://delivery.example/cozinha-tv', { headers: { cookie: 'amor_session=admin-secret' } })
  assert.equal(auth.readKitchenTvSessionToken(adminOnly), null)
  const both = new Request('https://delivery.example/cozinha-tv', {
    headers: { cookie: 'amor_session=admin-secret; kitchen_tv_session=tv-secret' },
  })
  assert.equal(auth.readKitchenTvSessionToken(both), 'tv-secret')
})

test('pairing credentials expire exactly thirty minutes after issue', async () => {
  const auth = await authPromise
  const now = new Date('2026-09-22T18:00:00.000Z')
  assert.equal(auth.kitchenTvPairingExpiresAt(now).toISOString(), '2026-09-22T18:30:00.000Z')
})
