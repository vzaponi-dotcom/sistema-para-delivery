import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { listEligibleBusinesses, updateMembership } from './memberships.js'

test('membership edits that outlive the original session roll back the member and audit', async t => {
  for (const input of [{ active: false }, { roleId: 'company-A:manager' }]) {
    const f = await createTenancyFixture(t)
    const expiresAt = new Date(f.now.getTime() + 20).toISOString()
    f.sqlite.prepare('UPDATE identity_sessions SET expires_at=? WHERE id=?').run(expiresAt, f.contexts.aliceA.identitySessionId)
    f.sqlite.prepare('UPDATE identity_session_families SET expires_at=? WHERE id=?').run(expiresAt, f.contexts.aliceA.familyId)
    f.sqlite.prepare('UPDATE sessions SET expires_at=? WHERE id=?').run(expiresAt, f.contexts.aliceA.sessionId)
    const before = f.sqlite.prepare('SELECT * FROM users WHERE id=?').get(f.members.bobA)
    const audits = f.sqlite.prepare('SELECT count(*) n FROM audit_events').get().n
    const db = { ...f.db, prepare(sql) { const statement = f.db.prepare(sql); if (!sql.startsWith('SELECT * FROM users WHERE')) return statement
      return { ...statement, bind(...values) { const bound = statement.bind(...values); return { ...bound, async first() { await new Promise(resolve => setTimeout(resolve, 60)); return bound.first() } } } }
    } }
    await assert.rejects(updateMembership(db, f.contexts.aliceA, f.members.bobA, input, f.now), { status: 409 })
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM users WHERE id=?').get(f.members.bobA), before)
    assert.equal(f.sqlite.prepare('SELECT count(*) n FROM audit_events').get().n, audits)
  }
})

test('eligible businesses belong only to the account and show its own role', async (t) => {
  const f = await createTenancyFixture(t)
  assert.deepEqual(await listEligibleBusinesses(f.db, f.accounts.alice), [
    { businessId: f.businesses.A, name: 'Company A', roleName: 'Gerente', hasLogo: false, logoVersion: null },
    { businessId: f.businesses.B, name: 'Company B', roleName: 'Operador', hasLogo: false, logoVersion: null },
  ])
  assert.deepEqual(await listEligibleBusinesses(f.db, f.accounts.admin), [])
})

test('membership changes in A revoke only its sessions and preserve B and global credential', async (t) => {
  const f = await createTenancyFixture(t)
  f.sqlite.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(`${f.businesses.A}:manager`, f.members.bobA)
  const credential = f.sqlite.prepare('SELECT * FROM account_credentials WHERE account_id = ?').get(f.accounts.alice)
  await updateMembership(f.db, f.contexts.aliceA, f.members.aliceA, { roleId: `${f.businesses.A}:operator` }, f.now)
  assert.ok(f.sqlite.prepare('SELECT revoked_at FROM identity_sessions WHERE id = ?').get(f.contexts.aliceA.identitySessionId).revoked_at)
  assert.equal(f.sqlite.prepare('SELECT revoked_at FROM identity_sessions WHERE id = ?').get(f.contexts.aliceB.identitySessionId).revoked_at, null)
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM account_credentials WHERE account_id = ?').get(f.accounts.alice), credential)
  assert.equal(f.sqlite.prepare('SELECT role_id FROM users WHERE id = ?').get(f.members.aliceB).role_id, `${f.businesses.B}:operator`)
})

test('last eligible manager cannot be removed, and concurrent removals leave one manager', async (t) => {
  const f = await createTenancyFixture(t)
  await assert.rejects(updateMembership(f.db, f.contexts.aliceA, f.members.aliceA, { active: false }, f.now), { status: 409 })
  f.sqlite.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(`${f.businesses.A}:manager`, f.members.bobA)
  const results = await Promise.allSettled([updateMembership(f.db, f.contexts.aliceA, f.members.aliceA, { active: false }, f.now), updateMembership(f.db, f.contexts.aliceA, f.members.bobA, { active: false }, f.now)])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM users WHERE business_id = ? AND role_id = ? AND active = 1 AND membership_state = 'active'").get(f.businesses.A, `${f.businesses.A}:manager`).n, 1)
})

test('company manager cannot edit a membership or role in another company', async (t) => {
  const f = await createTenancyFixture(t)
  await assert.rejects(updateMembership(f.db, f.contexts.aliceA, f.members.carolB, { active: false }, f.now), { status: 404 })
  await assert.rejects(updateMembership(f.db, f.contexts.aliceA, f.members.bobA, { roleId: `${f.businesses.B}:manager` }, f.now), { status: 404 })
})
