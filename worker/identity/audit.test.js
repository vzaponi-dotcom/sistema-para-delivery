import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { prepareIdentityAudit } from './audit.js'

test('identity audit stores only bounded event facts and never raw input secrets', async (t) => {
  const f = await createTenancyFixture(t)
  await prepareIdentityAudit(f.db, { accountId: f.accounts.alice, sessionId: f.contexts.aliceA.identitySessionId, action: 'login.success', result: 'success', now: f.now, password: 'private-password', token: 'private-token', origin: 'private-address', metadata: { token: 'private-token' } }).run()
  const rows = f.sqlite.prepare('SELECT * FROM identity_audit_events').all()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].action, 'login.success')
  assert.equal(JSON.stringify(rows).includes('private-'), false)
  assert.throws(() => prepareIdentityAudit(f.db, { action: 'private-token', result: 'success', now: f.now }), /evento|event/i)
})
