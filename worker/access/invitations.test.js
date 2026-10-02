import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from '../test-support/settingsDb.js'
import { seedBuiltinRoles } from './roles.js'
import { issueAccessInvite, prepareAccessInvite, consumeAccessInvite } from './invitations.js'
import { hashHumanPassword, verifyHumanPassword } from './credentials.js'
import { handleRequest } from '../index.js'
import { issueEmailChallenge, inspectEmailChallenge } from './emailChallenges.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-30T12:00:00.000Z')
const PASSWORD = 'a quiet river flows'
async function setup(t) {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  await seedBuiltinRoles(fixture.db, BUSINESS, NOW)
  fixture.sqlite.prepare(`INSERT INTO users (id, business_id, display_name, login_normalized, role_id, created_at, updated_at)
    VALUES ('user', ?, 'Person', 'person', ?, ?, ?)`).run(BUSINESS, `${BUSINESS}:manager`, NOW.toISOString(), NOW.toISOString())
  return fixture
}
const issue = (db, extra = {}) => issueAccessInvite(db, { businessId: BUSINESS, userId: 'user', purpose: 'activation', issuedBy: null, now: NOW, ...extra })
const invalid = { code: 'INVALID_INVITATION', status: 400 }

test('historical invitation acceptance cannot verify email and revokes competing email challenges',async t=>{
  const {db,sqlite}=await setup(t)
  sqlite.exec("UPDATE users SET login_normalized='person@example.test'")
  const emailLink=await issueEmailChallenge(db,{businessId:BUSINESS,userId:'user',purpose:'activation',now:NOW})
  const manual=await issue(db)
  await consumeAccessInvite(db,{token:manual.token,password:PASSWORD,businessId:BUSINESS,now:NOW})
  assert.equal(sqlite.prepare('SELECT email_verified_at FROM users').get().email_verified_at,null)
  assert.ok(sqlite.prepare('SELECT revoked_at FROM auth_email_challenges').get().revoked_at)
  await assert.rejects(inspectEmailChallenge(db,{businessId:BUSINESS,token:emailLink.token,now:NOW}))
  const reset=await issue(db,{purpose:'reset'})
  await consumeAccessInvite(db,{token:reset.token,password:'another quiet river',businessId:BUSINESS,now:NOW})
  assert.ok(sqlite.prepare('SELECT revision FROM user_credentials').get().revision>1)
})

test('invites store only digests, expire after 24 hours and atomically activate a credential without a session', async (t) => {
  const { db, sqlite } = await setup(t)
  const invite = await issue(db)
  assert.deepEqual(Object.keys(invite).sort(), ['expiresAt', 'token'])
  assert.equal(invite.expiresAt, '2026-10-01T12:00:00.000Z')
  assert.match(invite.token, /^[A-Za-z0-9_-]{43}$/)
  assert.deepEqual(await consumeAccessInvite(db, { token: invite.token, password: PASSWORD, now: NOW }), { userId: 'user' })
  const credential = sqlite.prepare('SELECT * FROM user_credentials').get()
  assert.ok(await verifyHumanPassword(PASSWORD, credential.password_verifier))
  assert.equal(credential.active, 1)
  assert.equal(sqlite.prepare('SELECT count(*) n FROM sessions').get().n, 0)
  const persisted = JSON.stringify(['users', 'user_credentials', 'access_invites', 'audit_events'].map((table) => sqlite.prepare(`SELECT * FROM ${table}`).all()))
  assert.equal(persisted.includes(invite.token), false)
  assert.equal(persisted.includes(PASSWORD), false)
  await assert.rejects(consumeAccessInvite(db, { token: invite.token, password: 'another quiet river', now: NOW }), invalid)
  assert.ok(await verifyHumanPassword(PASSWORD, sqlite.prepare('SELECT password_verifier FROM user_credentials').get().password_verifier))
})

test('expired, replaced, malformed and inactive-account invites cannot set credentials', async (t) => {
  const { db, sqlite } = await setup(t)
  const old = await issue(db)
  const current = await issue(db)
  for (const input of [{ token: old.token, now: NOW }, { token: current.token, now: new Date(current.expiresAt) }, { token: 'unknown', now: NOW }]) {
    await assert.rejects(consumeAccessInvite(db, { ...input, password: PASSWORD }), invalid)
  }
  assert.equal(sqlite.prepare('SELECT count(*) n FROM user_credentials').get().n, 0)
  sqlite.prepare('UPDATE users SET active = 0').run()
  await assert.rejects(consumeAccessInvite(db, { token: current.token, password: PASSWORD, now: NOW }), invalid)
  sqlite.prepare('UPDATE users SET active = 1').run()
  sqlite.prepare('UPDATE roles SET active = 0').run()
  await assert.rejects(consumeAccessInvite(db, { token: current.token, password: PASSWORD, now: NOW }), invalid)
})

test('concurrent accepts commit exactly one password and consume once', async (t) => {
  const { db, sqlite } = await setup(t)
  const { token } = await issue(db)
  const passwords = [PASSWORD, 'another quiet river']
  const results = await Promise.allSettled(passwords.map((password) => consumeAccessInvite(db, { token, password, now: NOW })))
  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1)
  assert.equal(results.filter(({ reason }) => reason?.code === 'INVALID_INVITATION').length, 1)
  const winner = results.findIndex(({ status }) => status === 'fulfilled')
  assert.ok(await verifyHumanPassword(passwords[winner], sqlite.prepare('SELECT password_verifier FROM user_credentials').get().password_verifier))
})

test('password validation failure leaves the invite usable and batch failure rolls back credential and consumption', async (t) => {
  const { db, sqlite } = await setup(t)
  const { token } = await issue(db)
  await assert.rejects(consumeAccessInvite(db, { token, password: 'too short', now: NOW }), { code: 'PASSWORD_TOO_SHORT' })
  sqlite.exec(`CREATE TRIGGER reject_consumption BEFORE UPDATE OF consumed_at ON access_invites
    BEGIN SELECT RAISE(ABORT, 'injected storage failure'); END`)
  await assert.rejects(consumeAccessInvite(db, { token, password: PASSWORD, now: NOW }))
  assert.equal(sqlite.prepare('SELECT count(*) n FROM user_credentials').get().n, 0)
  assert.equal(sqlite.prepare('SELECT consumed_at FROM access_invites').get().consumed_at, null)
  sqlite.exec('DROP TRIGGER reject_consumption')
  await consumeAccessInvite(db, { token, password: PASSWORD, now: NOW })
})

test('prepared reset statements compose with official writes and roll back replacement and revocations together', async (t) => {
  const { db, sqlite } = await setup(t)
  const original = await issue(db)
  await consumeAccessInvite(db, { token: original.token, password: PASSWORD, now: NOW })
  sqlite.prepare(`INSERT INTO sessions (id, business_id, user_id, device_mode, token_hash, created_at, expires_at, last_seen_at)
    VALUES ('session', ?, 'user', 'shared', 'digest', ?, ?, ?)`).run(BUSINESS, NOW.toISOString(), original.expiresAt, NOW.toISOString())
  // Model an outstanding activation prepared while credentials were inactive,
  // then an independent password change making them active again.
  sqlite.prepare('UPDATE user_credentials SET active = 0').run()
  const prior = await issue(db)
  sqlite.prepare('UPDATE user_credentials SET active = 1').run()
  const prepared = await prepareAccessInvite(db, { businessId: BUSINESS, userId: 'user', purpose: 'reset', issuedBy: 'user', now: NOW })
  assert.equal(sqlite.prepare('SELECT count(*) n FROM access_invites').get().n, 2)
  await assert.rejects(db.batch([...prepared.statements, db.prepare('INSERT INTO nonexistent VALUES (1)')]))
  assert.equal(sqlite.prepare('SELECT active FROM user_credentials').get().active, 1)
  assert.equal(sqlite.prepare('SELECT revoked_at FROM sessions').get().revoked_at, null)
  assert.equal(sqlite.prepare('SELECT revoked_at FROM access_invites WHERE consumed_at IS NULL').get().revoked_at, null)
  await db.batch(prepared.statements)
  assert.equal(sqlite.prepare('SELECT active FROM user_credentials').get().active, 0)
  assert.equal(sqlite.prepare('SELECT revoked_at FROM sessions').get().revoked_at, NOW.toISOString())
  await assert.rejects(consumeAccessInvite(db, { token: prior.token, password: PASSWORD, now: NOW }), invalid)
  await consumeAccessInvite(db, { token: prepared.token, password: 'another quiet river', now: NOW })
  assert.equal(sqlite.prepare('SELECT active FROM user_credentials').get().active, 1)
})

test('activation for an active credential aborts all composed official writes and preserves its password', async (t) => {
  const { db, sqlite } = await setup(t)
  const original = await issue(db)
  await consumeAccessInvite(db, { token: original.token, password: PASSWORD, now: NOW })
  const prepared = await prepareAccessInvite(db, { businessId: BUSINESS, userId: 'user', purpose: 'activation', now: NOW })
  await assert.rejects(db.batch([
    db.prepare("UPDATE users SET display_name = 'Changed' WHERE id = 'user'"), ...prepared.statements,
  ]))
  assert.equal(sqlite.prepare('SELECT display_name FROM users').get().display_name, 'Person')
  assert.equal(sqlite.prepare('SELECT count(*) n FROM access_invites').get().n, 1)
  await assert.rejects(issue(db), { code: 'INVITATION_ALREADY_ACTIVATED' })
  assert.ok(await verifyHumanPassword(PASSWORD, sqlite.prepare('SELECT password_verifier FROM user_credentials').get().password_verifier))
})

test('activation cannot overwrite a credential activated after invite issuance', async (t) => {
  const { db, sqlite } = await setup(t)
  const { token } = await issue(db)
  // An official independent password change may activate a credential before
  // this already-issued invite is accepted. Its state must be checked in batch.
  const verifier = await hashHumanPassword(PASSWORD)
  sqlite.prepare(`INSERT INTO user_credentials (business_id, user_id, password_verifier, password_changed_at, created_at, updated_at)
    VALUES (?, 'user', ?, ?, ?, ?)`).run(BUSINESS, verifier, NOW.toISOString(), NOW.toISOString(), NOW.toISOString())
  await assert.rejects(consumeAccessInvite(db, { token, password: 'another quiet river', now: NOW }), invalid)
  assert.equal(sqlite.prepare('SELECT password_verifier FROM user_credentials').get().password_verifier, verifier)
  assert.equal(sqlite.prepare('SELECT consumed_at FROM access_invites').get().consumed_at, null)
})

test('prepared activation can follow a new user insert in the same official batch', async (t) => {
  const { db, sqlite } = await setup(t)
  const prepared = await prepareAccessInvite(db, { businessId: BUSINESS, userId: 'new-user', purpose: 'activation', now: NOW })
  const results = await db.batch([
    db.prepare(`INSERT INTO users (id, business_id, display_name, login_normalized, role_id, created_at, updated_at)
      VALUES ('new-user', ?, 'New', 'new', ?, ?, ?)`).bind(BUSINESS, `${BUSINESS}:operator`, NOW.toISOString(), NOW.toISOString()),
    ...prepared.statements,
  ])
  assert.equal(results.at(-1).meta.changes, 1)
  assert.equal(sqlite.prepare("SELECT user_id FROM access_invites").get().user_id, 'new-user')
})

const acceptanceRequest = (token, origin = 'https://example.test', extra = {}) => new Request('https://example.test/api/access/invitations/accept', {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ token, password: PASSWORD, ...extra }),
})

test('public acceptance sets a password without authenticating and rejects cross-origin writes', async (t) => {
  const { db, sqlite } = await setup(t)
  const { token } = await issue(db, { now: new Date() })
  const forbidden = await handleRequest(acceptanceRequest(token, 'https://other.test'), { DB: db })
  assert.equal(forbidden.status, 403)
  assert.equal(sqlite.prepare('SELECT count(*) n FROM user_credentials').get().n, 0)
  const response = await handleRequest(acceptanceRequest(token), { DB: db })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { userId: 'user' })
  assert.equal(response.headers.get('set-cookie'), null)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(sqlite.prepare('SELECT count(*) n FROM sessions').get().n, 0)
  const repeat = await handleRequest(acceptanceRequest(token), { DB: db })
  assert.equal(repeat.status, 400)
  assert.equal((await repeat.json()).error.code, 'INVALID_INVITATION')
})

test('public invalid and expired invitations use the same recoverable response', async (t) => {
  const { db } = await setup(t)
  const { token } = await issue(db, { now: new Date('2000-01-01T00:00:00Z') })
  const responses = await Promise.all([token, 'x'.repeat(43)].map((value) => handleRequest(acceptanceRequest(value), { DB: db })))
  assert.deepEqual(responses.map(({ status }) => status), [400, 400])
  assert.deepEqual(await responses[0].json(), await responses[1].json())
})

test('public acceptance pins the business to Worker context even when the client supplies a tenant', async (t) => {
  const { db, sqlite } = await setup(t)
  sqlite.prepare('INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('other', 'other', 'Other', NOW.toISOString(), NOW.toISOString())
  await seedBuiltinRoles(db, 'other', NOW)
  sqlite.prepare(`INSERT INTO users (id, business_id, display_name, login_normalized, role_id, created_at, updated_at)
    VALUES ('other-user', 'other', 'Other', 'other', 'other:manager', ?, ?)`).run(NOW.toISOString(), NOW.toISOString())
  const { token } = await issueAccessInvite(db, { businessId: 'other', userId: 'other-user', purpose: 'activation', now: new Date() })
  const response = await handleRequest(acceptanceRequest(token, undefined, { businessId: 'other', business_id: 'other' }), { DB: db })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error.code, 'INVALID_INVITATION')
  assert.equal(sqlite.prepare('SELECT count(*) n FROM user_credentials').get().n, 0)
  assert.equal(sqlite.prepare('SELECT consumed_at FROM access_invites').get().consumed_at, null)
})

test('replacing an invitation during acceptance invalidates it at the transactional write', async (t) => {
  const { db, sqlite } = await setup(t)
  const { token } = await issue(db)
  let release
  let reached
  const atBatch = new Promise((resolve) => { reached = resolve })
  const gate = new Promise((resolve) => { release = resolve })
  const gatedDb = { prepare: db.prepare, async batch(statements) { reached(); await gate; return db.batch(statements) } }
  const pending = consumeAccessInvite(gatedDb, { token, password: PASSWORD, now: NOW })
  await atBatch
  const replacement = await issue(db)
  release()
  await assert.rejects(pending, invalid)
  assert.equal(sqlite.prepare('SELECT count(*) n FROM user_credentials').get().n, 0)
  await consumeAccessInvite(db, { token: replacement.token, password: PASSWORD, now: NOW })
})
