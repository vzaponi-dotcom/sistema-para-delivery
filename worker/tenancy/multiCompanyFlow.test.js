import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { createBusiness } from '../platform/businessProvisioning.js'
import { prepareMembershipInvitation, acceptCompanyInvitation } from './companyInvitations.js'
import { prepareAccountSession, authenticateAccountRequest } from '../identity/sessions.js'
import { commitIdentityStatements } from '../identity/transactions.js'
import { selectAccountScope } from './scopeSelection.js'
import { listEligibleBusinesses, updateMembership } from './memberships.js'
import { prepareIdentityChallenge, completeIdentityChallenge } from '../identity/challenges.js'
import { handlePlatformBusinessesApi } from '../platform/businessesApi.js'

test('real provisioning, acceptance, different roles, targeted deactivation and global recovery preserve company isolation', async t => {
  const f = await createTenancyFixture(t), env = { DB: f.db, AUTH_MULTI_COMPANY_ENABLED: 'true', AUTH_EMAIL_FROM: 'Mesiva <access@example.test>', AUTH_PUBLIC_ORIGIN: 'https://staging.example.test', RESEND_API_KEY: 'synthetic-test-key' }
  const messages = [], work = []
  const provision = (name, managerEmail) => createBusiness(env, f.contexts.admin, { name, managerName: 'Manager', managerEmail }, { now: f.now, idempotencyKey: crypto.randomUUID(), waitUntil: promise => work.push(promise), deliver: async (_, message) => { messages.push(message); return { status: 'accepted' } } })
  assert.deepEqual(await listEligibleBusinesses(f.db, f.accounts.admin), [])
  const A = await provision('Fresh A', 'fresh@example.test'), B = await provision('Fresh B', 'carol@example.test')
  await Promise.all(work)
  await acceptCompanyInvitation(f.db, { token: messages.find(message => message.businessId === A.businessId).token, password: 'Fresh manager password 2026!', now: f.now })
  const oldPassword = f.sqlite.prepare('SELECT password_verifier FROM account_credentials WHERE account_id=?').get(f.accounts.carol).password_verifier
  await acceptCompanyInvitation(f.db, { token: messages.find(message => message.businessId === B.businessId).token, context: f.contexts.carolB, now: f.now })
  assert.equal(f.sqlite.prepare('SELECT password_verifier FROM account_credentials WHERE account_id=?').get(f.accounts.carol).password_verifier, oldPassword)
  const accountId = f.sqlite.prepare("SELECT id FROM accounts WHERE email_normalized='fresh@example.test'").get().id
  const authenticate = token => authenticateAccountRequest(new Request('https://staging.example.test', { headers: { cookie: `mesiva_session=${token}` } }), env, f.now)
  const open = async (accountId, scope, businessId, revision = 1) => { const prepared = await prepareAccountSession(f.db, { accountId, expectedCredentialRevision: revision, scope, businessId, now: f.now }); await commitIdentityStatements(f.db, prepared.statements); return authenticate(prepared.value.token) }
  const managerA = await open(accountId, 'business', A.businessId), managerB = await open(f.accounts.carol, 'business', B.businessId)
  const invite = async (issuer, businessId, accountEmail, role) => { const prepared = await prepareMembershipInvitation(f.db, { issuer, businessId, accountEmail, displayName: 'Member', roleId: `${businessId}:${role}`, now: f.now }); await commitIdentityStatements(f.db, prepared.statements); return prepared.value }
  const invitationB = await invite(managerB, B.businessId, 'fresh@example.test', 'operator')
  await acceptCompanyInvitation(f.db, { token: invitationB.token, context: managerA, now: f.now })
  const listed = await listEligibleBusinesses(f.db, accountId)
  assert.deepEqual(listed.map(item => [item.name, item.roleName]), [['Fresh A', 'Gerente'], ['Fresh B', 'Operador']])
  await assert.rejects(updateMembership(f.db, managerA, managerA.userId, { active: false }, f.now), { status: 409 })
  const replacement = await invite(managerA, A.businessId, 'admin@example.test', 'manager')
  await acceptCompanyInvitation(f.db, { token: replacement.token, context: f.contexts.admin, now: f.now })
  const otherBrowserA = await open(accountId, 'business', A.businessId)
  const selected = await selectAccountScope(f.db, managerA, { scope: 'business', businessId: B.businessId, contextId: managerA.contextId }, f.now)
  const operatorB = await authenticate(selected.token)
  assert.equal(operatorB.roleName, 'Operador')
  assert.equal(operatorB.granted.has('access.users.manage'), false)
  const platform = await handlePlatformBusinessesApi(new Request('https://staging.example.test/api/platform/businesses', { headers: { 'X-Mesiva-Context': operatorB.contextId } }), env, operatorB, { now: f.now })
  assert.equal(platform.status, 403)
  const replacementContext = await open(f.accounts.admin, 'business', A.businessId)
  await updateMembership(f.db, replacementContext, otherBrowserA.userId, { active: false }, f.now)
  assert.equal(await authenticateAccountRequest(new Request('https://staging.example.test', { headers: { cookie: 'mesiva_session=invalid' } }), env, f.now), null)
  assert.equal((await f.db.prepare('SELECT revoked_at FROM identity_sessions WHERE id=?').bind(operatorB.identitySessionId).first()).revoked_at, null)
  assert.ok((await f.db.prepare('SELECT revoked_at FROM identity_sessions WHERE id=?').bind(otherBrowserA.identitySessionId).first()).revoked_at)
  const recovery = await prepareIdentityChallenge(f.db, { accountId, purpose: 'password_reset', expectedRevision: 1, now: f.now })
  await commitIdentityStatements(f.db, recovery.statements)
  await completeIdentityChallenge(f.db, { token: recovery.value.token, password: 'Recovered manager password 2026!', now: f.now })
  assert.equal(await authenticate(selected.token), null)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM identity_session_families WHERE account_id=? AND revoked_at IS NULL').get(accountId).n, 0)
  assert.deepEqual((await listEligibleBusinesses(f.db, accountId)).map(item => item.businessId), [B.businessId])
  const recovered = await open(accountId, 'business', B.businessId, 2)
  assert.equal(recovered.roleName, 'Operador')
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM print_stations WHERE business_id=?').get(A.businessId).n, 0)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM kitchen_tv_access WHERE business_id=?').get(A.businessId).n, 0)
})
