import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { prepareMembershipInvitation, inspectCompanyInvitation, acceptCompanyInvitation, resendCompanyInvitation, deliverPersistedCompanyInvitation } from './companyInvitations.js'
import { commitIdentityStatements } from '../identity/transactions.js'
import { prepareAccountSession, authenticateAccountRequest } from '../identity/sessions.js'
import { verifyHumanPassword } from '../access/credentials.js'
import { updateMembership } from './memberships.js'

const envFor = (db) => ({ DB: db, AUTH_MULTI_COMPANY_ENABLED: 'true', AUTH_EMAIL_ENABLED: 'true', AUTH_EMAIL_FROM: 'Mesiva <access@example.test>', AUTH_PUBLIC_ORIGIN: 'https://staging.example.test', RESEND_API_KEY: 're_synthetic_test_key' })
async function invite(f, overrides = {}) {
  const prepared = await prepareMembershipInvitation(f.db, { businessId: f.businesses.A, accountEmail: 'pending@example.test', displayName: 'New member', roleId: `${f.businesses.A}:operator`, issuer: f.contexts.aliceA, purpose: 'team', now: f.now, ...overrides })
  await commitIdentityStatements(f.db, prepared.statements)
  return prepared.value
}
async function identityContext(f, accountId) {
  const prepared = await prepareAccountSession(f.db, { accountId, expectedCredentialRevision: 1, scope: 'identity', now: f.now })
  await commitIdentityStatements(f.db, prepared.statements)
  return authenticateAccountRequest(new Request('https://example.test', { headers: { cookie: `mesiva_session=${prepared.value.token}` } }), { DB: f.db }, f.now)
}

test('delivered invitation identifies the role and company of the persisted invitation', async t => {
  const f = await createTenancyFixture(t)
  const issued = await invite(f)
  let payload
  const result = await deliverPersistedCompanyInvitation(f.db, envFor(f.db), issued, { now:f.now, fetchImpl:async (_url,options) => {
    payload = JSON.parse(options.body)
    return Response.json({id:'22222222-2222-4222-8222-222222222222'})
  } })
  assert.equal(result.status,'accepted')
  assert.match(payload.text,/Company A/)
  assert.match(payload.text,/Operador/)
  assert.match(payload.html,/Operador/)
  assert.doesNotMatch(payload.text,/Company B|Gerente/)
})

test('new identity invitation activates its credential and membership once', async (t) => {
  const f = await createTenancyFixture(t)
  const issued = await invite(f, { accountEmail: 'new-person@example.test' })
  const info = await inspectCompanyInvitation(f.db, { token: issued.token, now: f.now })
  assert.equal(info.businessName, 'Company A'); assert.equal(info.roleName, 'Operador'); assert.equal(info.requiresLogin, false)
  assert.equal(info.businesses, undefined)
  assert.deepEqual(await acceptCompanyInvitation(f.db, { token: issued.token, password: 'New member password 2026!', now: f.now }), { accepted: true, businessId: f.businesses.A })
  const account = f.sqlite.prepare("SELECT id,email_verified_at FROM accounts WHERE email_normalized = 'new-person@example.test'").get()
  assert.ok(account.email_verified_at)
  assert.equal(f.sqlite.prepare('SELECT membership_state FROM users WHERE id = ?').get(issued.userId).membership_state, 'active')
  assert.equal(f.sqlite.prepare('SELECT revision FROM account_credentials WHERE account_id = ?').get(account.id).revision, 1)
  await assert.rejects(acceptCompanyInvitation(f.db, { token: issued.token, password: 'Other member password 2026!', now: f.now }), { code: 'INVALID_COMPANY_INVITATION' })
})

test('existing account accepts only after matching authenticated identity and retains its credential and other company', async (t) => {
  const f = await createTenancyFixture(t)
  const issued = await invite(f, { accountEmail: 'carol@example.test', displayName: 'Carol at A' })
  const before = f.sqlite.prepare('SELECT * FROM account_credentials WHERE account_id = ?').get(f.accounts.carol)
  assert.equal((await inspectCompanyInvitation(f.db, { token: issued.token, now: f.now })).requiresLogin, true)
  await assert.rejects(acceptCompanyInvitation(f.db, { token: issued.token, password: 'Overwrite attempt 2026!', now: f.now }), { code: 'INVITATION_LOGIN_REQUIRED' })
  await assert.rejects(acceptCompanyInvitation(f.db, { token: issued.token, context: f.contexts.aliceA, now: f.now }), { code: 'INVITATION_ACCOUNT_MISMATCH' })
  await acceptCompanyInvitation(f.db, { token: issued.token, context: f.contexts.carolB, now: f.now })
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM account_credentials WHERE account_id = ?').get(f.accounts.carol), before)
  assert.equal(f.sqlite.prepare('SELECT display_name FROM accounts WHERE id = ?').get(f.accounts.carol).display_name, 'Carol')
  assert.equal(f.sqlite.prepare('SELECT role_id,membership_state FROM users WHERE id = ?').get(f.members.carolB).membership_state, 'active')
  await assert.rejects(resendCompanyInvitation(envFor(f.db), f.contexts.aliceA, issued.invitationId, { now: new Date(f.now.getTime() + 61_000), deliver: async () => ({ status: 'accepted' }) }), { code: 'MEMBERSHIP_ALREADY_ACTIVE' })
})

test('two invitations share one new account and competing activation never overwrites the winning password', async (t) => {
  const f = await createTenancyFixture(t)
  const preparedA = await prepareMembershipInvitation(f.db, { businessId: f.businesses.A, accountEmail: 'race@example.test', displayName: 'Race A', roleId: `${f.businesses.A}:operator`, issuer: f.contexts.aliceA, purpose: 'team', now: f.now })
  const preparedB = await prepareMembershipInvitation(f.db, { businessId: f.businesses.B, accountEmail: 'race@example.test', displayName: 'Race B', roleId: `${f.businesses.B}:operator`, issuer: f.contexts.carolB, purpose: 'team', now: f.now })
  await Promise.all([commitIdentityStatements(f.db, preparedA.statements), commitIdentityStatements(f.db, preparedB.statements)])
  const account = f.sqlite.prepare("SELECT id FROM accounts WHERE email_normalized = 'race@example.test'").get()
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM accounts WHERE email_normalized = 'race@example.test'").get().n, 1)
  const results = await Promise.allSettled([acceptCompanyInvitation(f.db, { token: preparedA.value.token, password: 'First race password 2026!', now: f.now }), acceptCompanyInvitation(f.db, { token: preparedB.value.token, password: 'Second race password 2026!', now: f.now })])
  const winner = results.findIndex((result) => result.status === 'fulfilled')
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1)
  const credential = f.sqlite.prepare('SELECT * FROM account_credentials WHERE account_id = ?').get(account.id)
  assert.ok(await verifyHumanPassword(winner === 0 ? 'First race password 2026!' : 'Second race password 2026!', credential.password_verifier))
  assert.equal(await verifyHumanPassword(winner === 0 ? 'Second race password 2026!' : 'First race password 2026!', credential.password_verifier), false)
  const remaining = winner === 0 ? preparedB.value : preparedA.value
  const context = await identityContext(f, account.id)
  await acceptCompanyInvitation(f.db, { token: remaining.token, context, now: f.now })
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM account_credentials WHERE account_id = ?').get(account.id), credential)
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM users WHERE account_id = ? AND membership_state = 'active'").get(account.id).n, 2)
})

test('first manager invitation activates company and membership in the same batch', async (t) => {
  const f = await createTenancyFixture(t)
  f.sqlite.prepare("UPDATE businesses SET access_status = 'pending' WHERE id = ?").run(f.businesses.A)
  const issued = await invite(f, { issuer: f.contexts.admin, purpose: 'first_manager', roleId: `${f.businesses.A}:manager` })
  await acceptCompanyInvitation(f.db, { token: issued.token, password: 'First manager password 2026!', now: f.now })
  assert.equal(f.sqlite.prepare('SELECT access_status FROM businesses WHERE id = ?').get(f.businesses.A).access_status, 'active')
  assert.equal(f.sqlite.prepare('SELECT membership_state FROM users WHERE id = ?').get(issued.userId).membership_state, 'active')
})

for (const [name, invalidate] of [
  ['expired', (f, issued) => f.sqlite.prepare('UPDATE company_invitations SET expires_at = ? WHERE id = ?').run('2026-10-02T12:01:00.000Z', issued.invitationId)],
  ['revoked', (f, issued) => f.sqlite.prepare('UPDATE company_invitations SET revoked_at = ? WHERE id = ?').run(f.now.toISOString(), issued.invitationId)],
  ['role changed', (f, issued) => f.sqlite.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(`${f.businesses.A}:manager`, issued.userId)],
  ['role disabled', (f) => f.sqlite.prepare('UPDATE roles SET active = 0 WHERE id = ?').run(`${f.businesses.A}:operator`)],
]) test(`invalid ${name} invitation cannot create a credential`, async (t) => {
  const f = await createTenancyFixture(t), issued = await invite(f)
  invalidate(f, issued)
  await assert.rejects(acceptCompanyInvitation(f.db, { token: issued.token, password: 'New member password 2026!', now: new Date(f.now.getTime() + 120_000) }), { code: 'INVALID_COMPANY_INVITATION' })
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM account_credentials WHERE account_id = ?').get(f.accounts.pending).n, 0)
})

test('resend has one concurrent winner, supersedes only its membership and keeps uncertain delivery valid', async (t) => {
  const f = await createTenancyFixture(t)
  const issued = await invite(f)
  const other = await invite(f, { businessId: f.businesses.B, roleId: `${f.businesses.B}:operator`, issuer: f.contexts.carolB })
  let message
  const options = { now: new Date(f.now.getTime() + 61_000), deliver: async (_env, data) => { message = data; return { status: 'uncertain' } } }
  const attempts = await Promise.allSettled([resendCompanyInvitation(envFor(f.db), f.contexts.aliceA, issued.invitationId, options), resendCompanyInvitation(envFor(f.db), f.contexts.aliceA, issued.invitationId, options)])
  assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(attempts.filter((result) => result.status === 'rejected').length, 1)
  await assert.rejects(inspectCompanyInvitation(f.db, { token: issued.token, now: options.now }), { code: 'INVALID_COMPANY_INVITATION' })
  assert.equal((await inspectCompanyInvitation(f.db, { token: message.token, now: options.now })).requiresLogin, false)
  assert.equal((await inspectCompanyInvitation(f.db, { token: other.token, now: options.now })).businessName, 'Company B')
})

test('resend preserves the manager-edited membership role instead of restoring a revoked invitation role', async (t) => {
  const f = await createTenancyFixture(t), issued = await invite(f)
  await updateMembership(f.db, f.contexts.aliceA, issued.userId, { roleId: `${f.businesses.A}:manager` }, f.now)
  let message
  const now = new Date(f.now.getTime() + 61_000)
  await resendCompanyInvitation(envFor(f.db), f.contexts.aliceA, issued.invitationId, { now, deliver: async (_env, data) => { message = data; return { status: 'accepted' } } })
  assert.equal(f.sqlite.prepare('SELECT role_id FROM users WHERE id = ?').get(issued.userId).role_id, `${f.businesses.A}:manager`)
  assert.equal((await inspectCompanyInvitation(f.db, { token: message.token, now })).roleName, 'Gerente')
})

test('resend cannot reactivate a deliberately disabled pending membership', async (t) => {
  const f = await createTenancyFixture(t), issued = await invite(f)
  await updateMembership(f.db, f.contexts.aliceA, issued.userId, { active: false }, f.now)
  await assert.rejects(resendCompanyInvitation(envFor(f.db), f.contexts.aliceA, issued.invitationId, { now: new Date(f.now.getTime() + 61_000), deliver: async () => ({ status: 'accepted' }) }), { code: 'MEMBERSHIP_INACTIVE' })
  assert.equal(f.sqlite.prepare('SELECT active FROM users WHERE id = ?').get(issued.userId).active, 0)
})

for (const mutation of ['role', 'disabled']) test(`resend cannot overwrite a concurrent ${mutation} edit during preparation`, async (t) => {
  const f = await createTenancyFixture(t), issued = await invite(f)
  let sends = 0
  const db = { ...f.db, prepare(sql) {
    const statement = f.db.prepare(sql)
    if (sql !== 'SELECT * FROM users WHERE business_id = ? AND login_normalized = ?') return statement
    return { ...statement, bind(...values) { const bound = statement.bind(...values); return { ...bound, async first() {
      if (mutation === 'role') f.sqlite.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(`${f.businesses.A}:manager`, issued.userId)
      else f.sqlite.prepare('UPDATE users SET active = 0 WHERE id = ?').run(issued.userId)
      return bound.first()
    } } } }
  } }
  await assert.rejects(resendCompanyInvitation(envFor(db), f.contexts.aliceA, issued.invitationId, { now: new Date(f.now.getTime() + 61_000), deliver: async () => { sends++; return { status: 'accepted' } } }), { status: 409 })
  assert.equal(sends, 0)
  const member = f.sqlite.prepare('SELECT role_id,active FROM users WHERE id = ?').get(issued.userId)
  if (mutation === 'role') assert.equal(member.role_id, `${f.businesses.A}:manager`)
  else assert.equal(member.active, 0)
})
