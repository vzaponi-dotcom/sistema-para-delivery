import test from 'node:test'
import assert from 'node:assert/strict'
import { hashHumanPassword, verifyHumanPassword } from './credentials.js'
import { PASSWORD_BLOCKLIST_VERSION, isBlockedPassword } from './passwordBlocklist.js'

test('password enrollment rejects short and locally blocked passwords without composition rules', async () => {
  await assert.rejects(hashHumanPassword('a'.repeat(14)), { code: 'PASSWORD_TOO_SHORT' })
  await assert.rejects(hashHumanPassword('passwordpassword'), { code: 'PASSWORD_BLOCKED' })
  assert.equal(PASSWORD_BLOCKLIST_VERSION, '2026-09-30.v1')
  assert.ok(isBlockedPassword('PasswordPassword'))
  const verifier = await hashHumanPassword('m'.repeat(15))
  assert.ok(await verifyHumanPassword('m'.repeat(15), verifier))
  assert.equal(await verifyHumanPassword('n'.repeat(15), verifier), false)
})

test('verifiers encode fixed version/cost and unique 16-byte salts without plaintext', async () => {
  const password = 'a quiet river flows'
  const first = await hashHumanPassword(password)
  const second = await hashHumanPassword(password)
  assert.match(first, /^v1\$pbkdf2-sha256\$100000\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=$/)
  assert.notEqual(first, second)
  assert.equal(first.includes(password), false)
  for (const invalid of [first.replace('v1', 'v2'), first.replace('100000', '99999'), `${first}$extra`, 'bad', null]) {
    assert.equal(await verifyHumanPassword(password, invalid), false)
  }
})

test('password length counts Unicode code points, accepts long passwords, and preserves whitespace', async () => {
  await assert.rejects(hashHumanPassword('😀'.repeat(14)), { code: 'PASSWORD_TOO_SHORT' })
  const password = ` ${'😀'.repeat(15)} ${'x'.repeat(64)} `
  const verifier = await hashHumanPassword(password)
  assert.ok(await verifyHumanPassword(password, verifier))
  assert.equal(await verifyHumanPassword(password.trim(), verifier), false)
  await assert.rejects(hashHumanPassword(null), { code: 'INVALID_PASSWORD' })
})
