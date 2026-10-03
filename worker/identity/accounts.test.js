import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { findAccountByEmail, prepareAccountCreation, verifyAccountLogin } from './accounts.js'
import { commitIdentityStatements } from './transactions.js'
import { verifyHumanPassword } from '../access/credentials.js'

test('global accounts preserve aliases and concurrent creation never overwrites existing identity', async (t) => {
  const f = await createTenancyFixture(t)
  const first = prepareAccountCreation(f.db, { id: 'new-1', email: ' Name+tag@Example.test ', displayName: 'First', now: f.now })
  const second = prepareAccountCreation(f.db, { id: 'new-2', email: 'name+tag@example.test', displayName: 'Second', now: f.now })
  await Promise.all([commitIdentityStatements(f.db, first.statements), commitIdentityStatements(f.db, second.statements)])
  assert.equal(first.value.email, 'name+tag@example.test')
  assert.equal((await findAccountByEmail(f.db, 'NAME+tag@example.test')).display_name, 'First')
  assert.equal(await findAccountByEmail(f.db, 'name@example.test'), null)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM accounts WHERE email_normalized = ?').get(first.value.email).n, 1)
  await commitIdentityStatements(f.db, prepareAccountCreation(f.db, { id: 'attempt', email: 'alice@example.test', displayName: 'Overwrite', now: f.now }).statements)
  assert.equal((await findAccountByEmail(f.db, 'alice@example.test')).display_name, 'Alice')
})

test('global login verifies passwords and rejects inactive, unverified and absent identities', async (t) => {
  const f = await createTenancyFixture(t)
  assert.equal((await verifyAccountLogin(f.db, { email: ' ALICE@example.test ', password: 'Fixture password 2026!' })).id, f.accounts.alice)
  assert.equal(await verifyAccountLogin(f.db, { email: 'alice@example.test', password: 'wrong' }), null)
  f.sqlite.prepare('UPDATE accounts SET email_verified_at = NULL WHERE id = ?').run(f.accounts.alice)
  assert.equal(await verifyAccountLogin(f.db, { email: 'alice@example.test', password: 'Fixture password 2026!' }), null)
  f.sqlite.prepare('UPDATE accounts SET active = 0 WHERE id = ?').run(f.accounts.bob)
  assert.equal(await verifyAccountLogin(f.db, { email: 'bob@example.test', password: 'Fixture password 2026!' }), null)
  let derivations = 0
  const verify = async (...args) => { derivations++; return verifyHumanPassword(...args) }
  assert.equal(await verifyAccountLogin(f.db, { email: 'absent@example.test', password: 'Fixture password 2026!' }, { verify }), null)
  assert.equal(derivations, 1)
})
