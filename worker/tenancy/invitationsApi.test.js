import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { prepareMembershipInvitation } from './companyInvitations.js'
import { handleCompanyInvitationsApi } from './invitationsApi.js'
import { commitIdentityStatements } from '../identity/transactions.js'
import { requestCredentialReset } from '../access/users.js'
import { handleAccessApi } from '../access/api.js'

const req = (path, body, origin = 'https://example.test') => new Request(`https://example.test${path}`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
test('public invitation endpoints return bounded metadata and enforce origin and single-use acceptance', async (t) => {
  const f = await createTenancyFixture(t)
  const prepared = await prepareMembershipInvitation(f.db, { businessId: f.businesses.A, accountEmail: 'pending@example.test', displayName: 'Pending', roleId: `${f.businesses.A}:operator`, issuer: f.contexts.aliceA, purpose: 'team', now: f.now })
  await commitIdentityStatements(f.db, prepared.statements)
  const path = '/api/auth/company-invitations'
  const response = await handleCompanyInvitationsApi(req(`${path}/inspect`, { token: prepared.value.token }), { DB: f.db }, { now: f.now })
  assert.equal(response.status, 200)
  const text = await response.text()
  assert.equal(text.includes(prepared.value.token), false)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal((await handleCompanyInvitationsApi(req(`${path}/accept`, { token: prepared.value.token, password: 'Member password 2026!' }, 'https://foreign.test'), { DB: f.db }, { now: f.now })).status, 403)
  assert.equal((await handleCompanyInvitationsApi(req(`${path}/accept`, { token: prepared.value.token, password: 'Member password 2026!' }), { DB: f.db }, { now: f.now })).status, 200)
})

test('company administrative reset cannot change a global credential after cutover', async (t) => {
  const f = await createTenancyFixture(t)
  const before = f.sqlite.prepare('SELECT * FROM account_credentials WHERE account_id = ?').get(f.accounts.bob)
  await assert.rejects(requestCredentialReset(f.db, f.contexts.aliceA, f.members.bobA, f.now, { env: { AUTH_MULTI_COMPANY_ENABLED: 'true' } }), { code: 'PERSONAL_RECOVERY_REQUIRED' })
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM account_credentials WHERE account_id = ?').get(f.accounts.bob), before)
})

test('access API password adapter uses the global credential, context marker and remaining Mesiva cookie deadline', async (t) => {
  const f = await createTenancyFixture(t)
  const request = req('/api/access/me/password', { currentPassword: 'Fixture password 2026!', password: 'Changed member password 2026!' })
  const context = f.contexts.aliceA
  request.headers.set('X-Mesiva-Context', context.contextId)
  // This adapter does not accept an unmarked global context through a legacy route.
  const unmarked = req('/api/access/me/password', { currentPassword: 'Fixture password 2026!', password: 'Changed member password 2026!' })
  await assert.rejects(handleAccessApi(unmarked, { DB: f.db, AUTH_MULTI_COMPANY_ENABLED: 'true' }, context, new URL(unmarked.url)), { code: 'SESSION_CONTEXT_CHANGED' })
  // Use a near-current fixture timestamp because this existing API gets its own clock.
  const now = new Date()
  f.sqlite.prepare('UPDATE identity_sessions SET expires_at = ? WHERE id = ?').run(new Date(now.getTime() + 3600_000).toISOString(), context.identitySessionId)
  f.sqlite.prepare('UPDATE identity_session_families SET expires_at = ? WHERE id = ?').run(new Date(now.getTime() + 3600_000).toISOString(), context.familyId)
  f.sqlite.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(new Date(now.getTime() + 3600_000).toISOString(), context.sessionId)
  const response = await handleAccessApi(request, { DB: f.db, AUTH_MULTI_COMPANY_ENABLED: 'true' }, context, new URL(request.url))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('set-cookie'), /^mesiva_session=/)
  assert.ok(Number(response.headers.get('set-cookie').match(/Max-Age=(\d+)/)[1]) <= 3600)
  assert.equal(f.sqlite.prepare('SELECT revision FROM account_credentials WHERE account_id = ?').get(f.accounts.alice).revision, 2)
})
