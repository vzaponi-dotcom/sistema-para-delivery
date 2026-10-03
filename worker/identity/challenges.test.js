import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { prepareIdentityChallenge, inspectIdentityChallenge, completeIdentityChallenge, changeAccountPassword } from './challenges.js'
import { prepareAccountSession, authenticateAccountRequest } from './sessions.js'
import { commitIdentityStatements } from './transactions.js'
import { verifyHumanPassword } from '../access/credentials.js'

async function challenge(f, purpose = 'password_reset', accountId = f.accounts.alice) {
  const prepared = await prepareIdentityChallenge(f.db, { accountId, purpose, expectedRevision: purpose === 'password_reset' ? 1 : undefined, now: f.now })
  await commitIdentityStatements(f.db, prepared.statements)
  return prepared.value
}

test('activation confirms the global account once without changing its name or memberships', async (t) => {
  const f = await createTenancyFixture(t)
  const issued = await challenge(f, 'activation', f.accounts.pending)
  assert.equal(Date.parse(issued.expiresAt) - f.now.getTime(), 24 * 3600_000)
  assert.deepEqual(await inspectIdentityChallenge(f.db, { token: issued.token, now: f.now }), { purpose: 'activation', expiresAt: issued.expiresAt })
  assert.equal(f.sqlite.prepare('SELECT token_hash FROM identity_challenges WHERE id = ?').get(issued.id).token_hash.includes(issued.token), false)
  assert.equal((await completeIdentityChallenge(f.db, { token: issued.token, password: 'New fixture password 2026!', now: f.now })).completed, true)
  const account = f.sqlite.prepare('SELECT display_name,email_verified_at FROM accounts WHERE id = ?').get(f.accounts.pending)
  assert.equal(account.display_name, 'Pending'); assert.ok(account.email_verified_at)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM users WHERE account_id = ?').get(f.accounts.pending).n, 0)
  await assert.rejects(completeIdentityChallenge(f.db, { token: issued.token, password: 'Other fixture password 2026!', now: f.now }), { code: 'INVALID_EMAIL_CHALLENGE' })
})

test('requesting reset keeps sessions, consuming it revokes every company and platform session', async (t) => {
  const f = await createTenancyFixture(t)
  for (const capability of ['platform.businesses.view', 'platform.businesses.create']) f.sqlite.prepare('INSERT INTO platform_grants(account_id,capability,created_at) VALUES(?,?,?)').run(f.accounts.alice, capability, f.now.toISOString())
  const platform = await prepareAccountSession(f.db, { accountId: f.accounts.alice, expectedCredentialRevision: 1, scope: 'platform', now: f.now })
  await commitIdentityStatements(f.db, platform.statements)
  f.sqlite.prepare("INSERT INTO company_invitations(id,business_id,account_id,user_id,email_normalized,role_id,expected_role_version,issued_by_account_id,issuer_scope,purpose,token_hash,created_at,expires_at) VALUES('pending-other-company',?,?,?,'alice@example.test',?,1,?,'business','team','invitation-digest',?,?)")
    .run(f.businesses.B, f.accounts.alice, f.members.aliceB, `${f.businesses.B}:operator`, f.accounts.alice, f.now.toISOString(), '2026-10-03T12:00:00.000Z')
  const issued = await challenge(f)
  assert.equal(Date.parse(issued.expiresAt) - f.now.getTime(), 30 * 60_000)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM identity_sessions WHERE account_id = ? AND revoked_at IS NULL').get(f.accounts.alice).n, 3)
  await completeIdentityChallenge(f.db, { token: issued.token, password: 'New fixture password 2026!', now: f.now })
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM identity_sessions WHERE account_id = ? AND revoked_at IS NULL').get(f.accounts.alice).n, 0)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.account_id = ? AND s.revoked_at IS NULL').get(f.accounts.alice).n, 0)
  assert.equal(f.sqlite.prepare('SELECT revision FROM account_credentials WHERE account_id = ?').get(f.accounts.alice).revision, 2)
  const invitation = f.sqlite.prepare("SELECT consumed_at,revoked_at FROM company_invitations WHERE id = 'pending-other-company'").get()
  assert.equal(invitation.consumed_at, null); assert.equal(invitation.revoked_at, null)
  assert.ok(await verifyHumanPassword('New fixture password 2026!', f.sqlite.prepare('SELECT password_verifier FROM account_credentials WHERE account_id = ?').get(f.accounts.alice).password_verifier))
})

test('expired, revoked, superseded and concurrent challenge consumers cannot overwrite a credential', async (t) => {
  const f = await createTenancyFixture(t)
  const old = await challenge(f)
  const current = await challenge(f)
  await assert.rejects(completeIdentityChallenge(f.db, { token: old.token, password: 'Other fixture password 2026!', now: f.now }), { code: 'INVALID_EMAIL_CHALLENGE' })
  await assert.rejects(inspectIdentityChallenge(f.db, { token: current.token, now: new Date(current.expiresAt) }), { code: 'INVALID_EMAIL_CHALLENGE' })
  const results = await Promise.allSettled([completeIdentityChallenge(f.db, { token: current.token, password: 'New fixture password 2026!', now: f.now }), completeIdentityChallenge(f.db, { token: current.token, password: 'Other fixture password 2026!', now: f.now })])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1)
  assert.equal(f.sqlite.prepare('SELECT revision FROM account_credentials WHERE account_id = ?').get(f.accounts.alice).revision, 2)
})

test('own password requires current password and leaves only an eligible successor with the same deadline', async (t) => {
  const f = await createTenancyFixture(t)
  await assert.rejects(changeAccountPassword(f.db, f.contexts.aliceA, { currentPassword: 'wrong', password: 'New fixture password 2026!' }, f.now), { code: 'INVALID_CURRENT_PASSWORD' })
  const value = await changeAccountPassword(f.db, f.contexts.aliceA, { currentPassword: 'Fixture password 2026!', password: 'New fixture password 2026!' }, f.now)
  assert.equal(value.changed, true)
  assert.equal(value.expiresAt, f.contexts.aliceA.expiresAt)
  const context = await authenticateAccountRequest(new Request('https://example.test', { headers: { cookie: `mesiva_session=${value.token}` } }), { DB: f.db }, f.now)
  assert.equal(context.businessId, f.businesses.A)
  assert.equal(context.familyId, f.contexts.aliceA.familyId)
  assert.equal(context.credentialRevision, 2)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM identity_sessions WHERE account_id = ? AND revoked_at IS NULL').get(f.accounts.alice).n, 1)
})

test('challenge expiry during password derivation fails atomically', async (t) => {
  const f = await createTenancyFixture(t)
  const issued = await challenge(f)
  let reads = 0
  await assert.rejects(completeIdentityChallenge(f.db, { token: issued.token, password: 'New fixture password 2026!', now: f.now, monotonicNow: () => reads++ === 0 ? 0 : 31 * 60_000 }), { code: 'INVALID_EMAIL_CHALLENGE' })
  assert.equal(f.sqlite.prepare('SELECT revision FROM account_credentials WHERE account_id = ?').get(f.accounts.alice).revision, 1)
})

test('own password may complete after its company access disappears without issuing an ineligible successor', async (t) => {
  const f = await createTenancyFixture(t)
  let reads = 0
  const db = { ...f.db, prepare(sql) {
    const statement = f.db.prepare(sql)
    if (!sql.includes('FROM identity_sessions s')) return statement
    return { ...statement, bind(...values) { const bound = statement.bind(...values); return { ...bound, async first() {
      if (++reads === 2) f.sqlite.prepare('UPDATE users SET active = 0 WHERE id = ?').run(f.members.aliceA)
      return bound.first()
    } } } }
  } }
  const value = await changeAccountPassword(db, f.contexts.aliceA, { currentPassword: 'Fixture password 2026!', password: 'New fixture password 2026!' }, f.now)
  assert.equal(value.changed, true)
  assert.equal(value.token, undefined)
  assert.equal(f.sqlite.prepare('SELECT revision FROM account_credentials WHERE account_id = ?').get(f.accounts.alice).revision, 2)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM identity_sessions WHERE account_id = ? AND revoked_at IS NULL').get(f.accounts.alice).n, 0)
})
