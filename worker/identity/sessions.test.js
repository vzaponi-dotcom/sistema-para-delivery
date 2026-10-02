import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { prepareAccountSession, authenticateAccountRequest, revokeBrowserFamily } from './sessions.js'
import { accountSessionCookie } from '../auth.js'
import { commitIdentityStatements } from './transactions.js'

const requestFor = (token) => new Request('https://staging.example.test/api/auth/session', { headers: { cookie: `mesiva_session=${token}` } })
async function issue(f, overrides = {}) {
  const prepared = await prepareAccountSession(f.db, { accountId: f.accounts.alice, expectedCredentialRevision: 1, scope: 'identity', now: f.now, deviceMode: 'shared', ...overrides })
  await commitIdentityStatements(f.db, prepared.statements)
  return prepared.value
}

test('identity sessions authenticate without operation and preserve absolute device deadlines', async (t) => {
  const f = await createTenancyFixture(t)
  for (const [deviceMode, hours] of [['shared', 12], ['personal', 168]]) {
    const value = await issue(f, { deviceMode })
    assert.match(value.token, /^[A-Za-z0-9_-]{43}$/)
    assert.equal(Date.parse(value.expiresAt) - f.now.getTime(), hours * 3600_000)
    const context = await authenticateAccountRequest(requestFor(value.token), { DB: f.db }, f.now)
    assert.equal(context.accountId, f.accounts.alice)
    assert.equal(context.scope, 'identity')
    assert.equal(context.businessId, undefined)
    assert.equal(context.granted, undefined)
    assert.match(accountSessionCookie(value.token, value.expiresAt, f.now), /^mesiva_session=.*; HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=/)
    assert.equal(accountSessionCookie(value.token, value.expiresAt, f.now).includes('Domain='), false)
    assert.equal(await authenticateAccountRequest(requestFor(value.token), { DB: f.db }, new Date(value.expiresAt)), null)
  }
})

test('business session is linked to the correct account actor and role, platform has no operational grants', async (t) => {
  const f = await createTenancyFixture(t)
  const business = await issue(f, { scope: 'business', businessId: f.businesses.B })
  const context = await authenticateAccountRequest(requestFor(business.token), { DB: f.db }, f.now)
  assert.equal(context.userId, f.members.aliceB)
  assert.equal(context.businessId, f.businesses.B)
  assert.equal(context.roleName, 'Operador')
  assert.equal(context.granted.has('orders.create'), true)
  assert.equal(context.granted.has('access.users.manage'), false)
  assert.equal(f.sqlite.prepare('SELECT user_id FROM sessions WHERE id = ?').get(context.sessionId).user_id, f.members.aliceB)
  const platform = await issue(f, { accountId: f.accounts.admin, scope: 'platform' })
  const admin = await authenticateAccountRequest(requestFor(platform.token), { DB: f.db }, f.now)
  assert.equal(admin.platformGranted.has('platform.businesses.create'), true)
  assert.equal(admin.granted, undefined)
  assert.equal(admin.businessId, undefined)
  await assert.rejects(issue(f, { accountId: f.accounts.admin, scope: 'business', businessId: f.businesses.B }), { status: 403 })
})

test('global authentication rejects changed credentials, inactive memberships, revoked browser and legacy cookie', async (t) => {
  const f = await createTenancyFixture(t)
  const one = await issue(f, { scope: 'business', businessId: f.businesses.A })
  const two = await issue(f, { scope: 'business', businessId: f.businesses.B })
  const first = await authenticateAccountRequest(requestFor(one.token), { DB: f.db }, f.now)
  await revokeBrowserFamily(f.db, first, f.now)
  assert.equal(await authenticateAccountRequest(requestFor(one.token), { DB: f.db }, f.now), null)
  assert.equal((await authenticateAccountRequest(requestFor(two.token), { DB: f.db }, f.now)).businessId, f.businesses.B)
  f.sqlite.prepare("UPDATE users SET membership_state = 'inactive' WHERE id = ?").run(f.members.aliceB)
  assert.equal(await authenticateAccountRequest(requestFor(two.token), { DB: f.db }, f.now), null)
  const identity = await issue(f)
  f.sqlite.prepare('UPDATE account_credentials SET revision = revision + 1 WHERE account_id = ?').run(f.accounts.alice)
  assert.equal(await authenticateAccountRequest(requestFor(identity.token), { DB: f.db }, f.now), null)
  assert.equal(await authenticateAccountRequest(new Request('https://staging.example.test', { headers: { cookie: `amor_session=${identity.token}` } }), { DB: f.db }, f.now), null)
})

test('prepared session revalidates credential revision and membership immediately before commit', async (t) => {
  const f = await createTenancyFixture(t)
  const prepared = await prepareAccountSession(f.db, { accountId: f.accounts.alice, expectedCredentialRevision: 1, scope: 'business', businessId: f.businesses.A, now: f.now })
  f.sqlite.prepare('UPDATE account_credentials SET revision = 2 WHERE account_id = ?').run(f.accounts.alice)
  await assert.rejects(commitIdentityStatements(f.db, prepared.statements))
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM identity_sessions WHERE id = ?').get(prepared.value.identitySessionId).n, 0)
})
