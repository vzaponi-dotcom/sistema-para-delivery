import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { preparePlatformAdministrator, prepareExistingBusinessManager, readMultiCompanyReadiness, finalizeMultiCompanyStaging, issueVerifiedAccountRecovery } from './bootstrap.js'
import { completeIdentityChallenge } from '../identity/challenges.js'
import { acceptCompanyInvitation } from '../tenancy/companyInvitations.js'
import { handleRequest } from '../index.js'
import { sha256Hex } from '../auth.js'

test('private verified-manager activation revalidates recipient account eligibility in its batch', async t => {
  for (const mutation of ['active=0', 'email_verified_at=NULL']) {
    const f = await createTenancyFixture(t)
    await preparePlatformAdministrator(f.db, { name: 'Admin', email: 'admin@example.test', ownershipVerified: true, now: f.now })
    let batches = 0
    const db = { ...f.db, batch: async statements => { if (++batches === 2) f.sqlite.prepare(`UPDATE accounts SET ${mutation} WHERE id=?`).run(f.accounts.alice); return f.db.batch(statements) } }
    await assert.rejects(prepareExistingBusinessManager(db, { businessId: 'amor-e-sabor', name: 'Alice', email: 'alice@example.test', ownershipVerified: true, now: f.now }))
    assert.equal(f.sqlite.prepare('SELECT access_status FROM businesses WHERE id=?').get('amor-e-sabor').access_status, 'legacy')
    assert.equal(f.sqlite.prepare('SELECT count(*) n FROM users WHERE business_id=? AND account_id=?').get('amor-e-sabor', f.accounts.alice).n, 0)
  }
})

test('private administrator requires ownership; repeat preserves active credential and grants', async t => {
  const f = await createTenancyFixture(t)
  await assert.rejects(preparePlatformAdministrator(f.db, { name: 'Admin', email: 'admin@example.test', now: f.now }), /titularidade/)
  const before = f.sqlite.prepare('SELECT * FROM account_credentials WHERE account_id=?').get(f.accounts.admin)
  for (let n = 0; n < 2; n++) assert.equal((await preparePlatformAdministrator(f.db, { name: 'Admin', email: 'admin@example.test', ownershipVerified: true, now: f.now })).activated, true)
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM account_credentials WHERE account_id=?').get(f.accounts.admin), before)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM platform_grants WHERE account_id=?').get(f.accounts.admin).n, 3)
})
test('new bootstrap activates admin and manager; readiness/finalization preserve unlisted global accounts and history', async t => {
  const f = await createTenancyFixture(t)
  const admin = await preparePlatformAdministrator(f.db, { name: 'Owner', email: 'owner@example.test', ownershipVerified: true, now: f.now })
  assert.equal(admin.activated, false)
  assert.notEqual(f.sqlite.prepare('SELECT token_hash FROM identity_challenges WHERE id=?').get(admin.challenge.id).token_hash, admin.challenge.token)
  await completeIdentityChallenge(f.db, { token: admin.challenge.token, password: 'New platform password 2026!', now: f.now })
  const manager = await prepareExistingBusinessManager(f.db, { businessId: 'amor-e-sabor', name: 'Manager', email: 'manager@example.test', ownershipVerified: true, now: f.now })
  assert.equal((await readMultiCompanyReadiness(f.db, { adminAccountId: admin.accountId, businessId: 'amor-e-sabor', managerAccountId: manager.accountId })).ready, false)
  await acceptCompanyInvitation(f.db, { token: manager.invitation.token, password: 'New manager password 2026!', now: f.now })
  const readiness = await readMultiCompanyReadiness(f.db, { adminAccountId: admin.accountId, businessId: 'amor-e-sabor', managerAccountId: manager.accountId })
  assert.equal(readiness.ready, true)
  const history = f.sqlite.prepare('SELECT count(*) n FROM orders').get().n
  const inventory = JSON.parse(f.sqlite.prepare('SELECT legacy_inventory_json FROM platform_bootstraps').get().legacy_inventory_json)
  assert.equal((await finalizeMultiCompanyStaging(f.db, inventory, { ...readiness, loginVerified: true })).changed, true)
  assert.equal((await finalizeMultiCompanyStaging(f.db, inventory, { ...readiness, loginVerified: true })).changed, false)
  assert.equal(f.sqlite.prepare('SELECT active FROM accounts WHERE id=?').get(f.accounts.alice).active, 1)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM orders').get().n, history)
  f.sqlite.prepare('DELETE FROM platform_grants WHERE account_id=?').run(admin.accountId)
  await assert.rejects(finalizeMultiCompanyStaging(f.db, inventory, { ...readiness, loginVerified: true }))
})
test('private recovery stores only a hash and changes no credential/session before consumption', async t => {
  const f = await createTenancyFixture(t)
  await assert.rejects(issueVerifiedAccountRecovery(f.db, { accountId: f.accounts.alice, now: f.now }))
  const result = await issueVerifiedAccountRecovery(f.db, { accountId: f.accounts.alice, ownershipVerified: true, now: f.now })
  assert.equal(Date.parse(result.expiresAt) - f.now.getTime(), 30 * 60_000)
  assert.equal(f.sqlite.prepare('SELECT token_hash FROM identity_challenges WHERE id=?').get(result.id).token_hash, await sha256Hex(result.token))
  assert.equal(f.sqlite.prepare('SELECT revision FROM account_credentials WHERE account_id=?').get(f.accounts.alice).revision, 1)
  assert.equal(f.sqlite.prepare('SELECT revoked_at FROM identity_sessions WHERE id=?').get(f.contexts.aliceA.identitySessionId).revoked_at, null)
})
test('verified private manager preparation reuses global identity with ownership proof without overwriting password', async t => {
  const f = await createTenancyFixture(t)
  await preparePlatformAdministrator(f.db, { name: 'Admin', email: 'admin@example.test', ownershipVerified: true, now: f.now })
  const before = f.sqlite.prepare('SELECT * FROM account_credentials WHERE account_id=?').get(f.accounts.admin)
  await assert.rejects(prepareExistingBusinessManager(f.db, { businessId: 'amor-e-sabor', name: 'Admin', email: 'admin@example.test', now: f.now }))
  const result = await prepareExistingBusinessManager(f.db, { businessId: 'amor-e-sabor', name: 'Admin', email: 'admin@example.test', ownershipVerified: true, now: f.now })
  assert.equal(result.activated, true)
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM account_credentials WHERE account_id=?').get(f.accounts.admin), before)
  assert.equal((await readMultiCompanyReadiness(f.db, { adminAccountId: f.accounts.admin, businessId: 'amor-e-sabor', managerAccountId: f.accounts.admin })).ready, true)
})
test('finalization rechecks supported credentials in its atomic batch and revokes the inventoried PIN sessions', async t => {
  const f = await createTenancyFixture(t)
  await preparePlatformAdministrator(f.db, { name: 'Admin', email: 'admin@example.test', ownershipVerified: true, now: f.now })
  await prepareExistingBusinessManager(f.db, { businessId: 'amor-e-sabor', name: 'Admin', email: 'admin@example.test', ownershipVerified: true, now: f.now })
  const readiness = { ...(await readMultiCompanyReadiness(f.db, { adminAccountId: f.accounts.admin, businessId: 'amor-e-sabor', managerAccountId: f.accounts.admin })), loginVerified: true }
  const inventory = JSON.parse(f.sqlite.prepare('SELECT legacy_inventory_json FROM platform_bootstraps').get().legacy_inventory_json)
  f.sqlite.prepare('INSERT INTO sessions(id,business_id,token_hash,created_at,expires_at,last_seen_at) VALUES(?,?,?,?,?,?)').run('pin-session', 'amor-e-sabor', 'pin-hash', f.now.toISOString(), '2026-10-03T00:00:00.000Z', f.now.toISOString())
  let injected = false
  const db = { ...f.db, batch: async statements => { if (!injected) { injected = true; f.sqlite.prepare('UPDATE account_credentials SET revision=revision+1 WHERE account_id=?').run(f.accounts.admin) }; return f.db.batch(statements) } }
  await assert.rejects(finalizeMultiCompanyStaging(db, inventory, readiness))
  assert.equal(f.sqlite.prepare('SELECT finalized_at FROM platform_bootstraps').get().finalized_at, null)
  await finalizeMultiCompanyStaging(f.db, inventory, readiness)
  assert.ok(f.sqlite.prepare('SELECT revoked_at FROM sessions WHERE id=?').get('pin-session').revoked_at)
})
test('prepare flag exposes only global challenge endpoints while the legacy session and panel remain closed', async t => {
  const f = await createTenancyFixture(t)
  const admin = await preparePlatformAdministrator(f.db, { name: 'Owner', email: 'owner@example.test', ownershipVerified: true, now: new Date() })
  const env = { DB: f.db, AUTH_MULTI_COMPANY_ENABLED: 'false', AUTH_MULTI_COMPANY_PREPARE_ENABLED: 'true' }
  const request = (path, body) => new Request(`https://staging.example.test${path}`, { method: body ? 'POST' : 'GET', headers: { origin: 'https://staging.example.test', 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const inspect = await handleRequest(request('/api/auth/email-challenges/inspect', { token: admin.challenge.token }), env)
  assert.equal(inspect.status, 200)
  const session = await (await handleRequest(request('/api/auth/session'), env)).json()
  assert.notEqual(session.authMode, 'multi_company')
  assert.equal((await handleRequest(request('/api/platform/businesses'), env)).status, 401)
  assert.equal((await handleRequest(request('/api/auth/select-platform', {}), env)).status, 401)
})
