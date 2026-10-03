import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { selectAccountScope } from './scopeSelection.js'
import { authenticateAccountRequest } from '../identity/sessions.js'

test('switch A to B preserves deadline and immutable historical actor and audit references', async (t) => {
  const f = await createTenancyFixture(t)
  const origin = f.contexts.aliceA
  f.sqlite.prepare("INSERT INTO audit_events(id,business_id,occurred_at,actor_type,actor_user_id,actor_name,session_id,action,result) VALUES('historical',?,?,'user',?,'Alice',?,'order.created','success')").run(f.businesses.A, f.now.toISOString(), origin.userId, origin.sessionId)
  const value = await selectAccountScope(f.db, origin, { scope: 'business', businessId: f.businesses.B, contextId: origin.contextId }, new Date(f.now.getTime() + 3600_000))
  assert.equal(value.expiresAt, origin.expiresAt)
  const context = await authenticateAccountRequest(new Request('https://example.test', { headers: { cookie: `mesiva_session=${value.token}` } }), { DB: f.db }, f.now)
  assert.equal(context.userId, f.members.aliceB)
  assert.equal(context.businessId, f.businesses.B)
  assert.notEqual(context.contextId, origin.contextId)
  const historical = f.sqlite.prepare("SELECT business_id,actor_user_id,session_id FROM audit_events WHERE id = 'historical'").get()
  assert.equal(historical.business_id, f.businesses.A)
  assert.equal(historical.session_id, origin.sessionId)
  assert.equal(f.sqlite.prepare('SELECT business_id,revoked_at FROM sessions WHERE id = ?').get(origin.sessionId).business_id, f.businesses.A)
  assert.ok(f.sqlite.prepare('SELECT revoked_at FROM identity_sessions WHERE id = ?').get(origin.identitySessionId).revoked_at)
})

test('a current browser session permits exactly one concurrent switch', async (t) => {
  const f = await createTenancyFixture(t)
  const input = { scope: 'business', businessId: f.businesses.B, contextId: f.contexts.aliceA.contextId }
  const results = await Promise.allSettled([selectAccountScope(f.db, f.contexts.aliceA, input, f.now), selectAccountScope(f.db, f.contexts.aliceA, input, f.now)])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1)
  assert.deepEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(), [])
})

test('scope selection cannot use a stale marker or give administrator implicit company access', async (t) => {
  const f = await createTenancyFixture(t)
  await assert.rejects(selectAccountScope(f.db, f.contexts.aliceA, { scope: 'business', businessId: f.businesses.B, contextId: 'stale' }, f.now), { code: 'SESSION_CONTEXT_CHANGED' })
  await assert.rejects(selectAccountScope(f.db, f.contexts.admin, { scope: 'business', businessId: f.businesses.B, contextId: f.contexts.admin.contextId }, f.now), { status: 403 })
  await assert.rejects(selectAccountScope(f.db, f.contexts.aliceA, { scope: 'platform', contextId: f.contexts.aliceA.contextId }, f.now), { status: 403 })
})

for (const [name, mutation] of [
  ['origin membership revoked', (f) => f.sqlite.prepare("UPDATE users SET membership_state = 'inactive' WHERE id = ?").run(f.members.aliceA)],
  ['target membership revoked', (f) => f.sqlite.prepare("UPDATE users SET membership_state = 'inactive' WHERE id = ?").run(f.members.aliceB)],
  ['password revision changed', (f) => f.sqlite.prepare('UPDATE account_credentials SET revision = revision + 1 WHERE account_id = ?').run(f.accounts.alice)],
  ['origin role revoked', (f) => f.sqlite.prepare('UPDATE roles SET active = 0 WHERE id = ?').run(`${f.businesses.A}:manager`)],
  ['target role changed', (f) => f.sqlite.prepare('UPDATE roles SET version = version + 1 WHERE id = ?').run(`${f.businesses.B}:operator`)],
  ['browser expired', (f) => f.sqlite.prepare('UPDATE identity_session_families SET expires_at = ? WHERE id = ?').run('2026-10-02T12:30:00.000Z', f.contexts.aliceA.familyId)],
]) {
  test(`scope commit fails atomically when ${name} during preparation`, async (t) => {
    const f = await createTenancyFixture(t)
    const db = { ...f.db, async batch(statements) { mutation(f); return f.db.batch(statements) } }
    await assert.rejects(selectAccountScope(db, f.contexts.aliceA, { scope: 'business', businessId: f.businesses.B, contextId: f.contexts.aliceA.contextId }, new Date('2026-10-02T13:00:00.000Z')), { code: 'SESSION_CONTEXT_CHANGED' })
    assert.equal(f.sqlite.prepare('SELECT count(*) n FROM identity_sessions WHERE family_id = ?').get(f.contexts.aliceA.familyId).n, 1)
  })
}

test('administrative concession revoked during preparation prevents the switch', async (t) => {
  const f = await createTenancyFixture(t)
  const db = { ...f.db, async batch(statements) { f.sqlite.prepare('DELETE FROM platform_grants WHERE account_id = ?').run(f.accounts.admin); return f.db.batch(statements) } }
  await assert.rejects(selectAccountScope(db, f.contexts.admin, { scope: 'identity', contextId: f.contexts.admin.contextId }, f.now), { code: 'SESSION_CONTEXT_CHANGED' })
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM identity_sessions WHERE family_id = ?').get(f.contexts.admin.familyId).n, 1)
})

test('session that expires during asynchronous preparation cannot commit the switch', async (t) => {
  const f = await createTenancyFixture(t)
  let clockRead = 0
  const monotonicNow = () => clockRead++ === 0 ? 0 : 120_000
  await assert.rejects(selectAccountScope(f.db, f.contexts.aliceA,
    { scope: 'business', businessId: f.businesses.B, contextId: f.contexts.aliceA.contextId },
    new Date('2026-10-02T23:59:00.000Z'), { monotonicNow }), { code: 'SESSION_CONTEXT_CHANGED' })
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM identity_sessions WHERE family_id = ?').get(f.contexts.aliceA.familyId).n, 1)
})
