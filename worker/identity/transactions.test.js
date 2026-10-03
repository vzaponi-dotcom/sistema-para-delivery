import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { prepareIdentityAssertion, commitIdentityStatements } from './transactions.js'

test('identity assertion rolls back every mutation and successful batches leave no guards', async (t) => {
  const { db, sqlite, accounts } = await createTenancyFixture(t)
  const update = () => db.prepare('UPDATE accounts SET display_name = ? WHERE id = ?').bind('Changed', accounts.alice)
  await assert.rejects(commitIdentityStatements(db, [update(), prepareIdentityAssertion(db, 'invalid', 'SELECT 0', [])]))
  assert.equal(sqlite.prepare('SELECT display_name FROM accounts WHERE id = ?').get(accounts.alice).display_name, 'Alice')
  await commitIdentityStatements(db, [prepareIdentityAssertion(db, 'valid', 'SELECT 1', []), update()])
  assert.equal(sqlite.prepare('SELECT display_name FROM accounts WHERE id = ?').get(accounts.alice).display_name, 'Changed')
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM identity_tx_assertions').get().n, 0)
})
