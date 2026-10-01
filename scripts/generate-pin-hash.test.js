import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { verifyPin } from '../worker/auth.js'

test('PIN hash generator normalizes surrounding whitespace like the login endpoint', async () => {
  const verifier = execFileSync(process.execPath, ['scripts/generate-pin-hash.mjs'], {
    env: { ...process.env, PIN: ' 4827\n' },
    encoding: 'utf8',
  }).trim()

  assert.equal(await verifyPin('4827', verifier), true)
})
