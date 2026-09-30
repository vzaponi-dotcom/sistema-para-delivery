import test from 'node:test'
import assert from 'node:assert/strict'
import { isBlockedPassword } from './passwordBlocklist.js'

test('local blocklist rejects common long passwords and their compatibility spelling', () => {
  for (const password of ['PASSWORDPASSWORD', '１２３４５６７８９０１２３４５', 'correct horse battery staple']) assert.ok(isBlockedPassword(password))
  assert.equal(isBlockedPassword('a quiet river flows'), false)
  assert.equal(isBlockedPassword(null), false)
})
