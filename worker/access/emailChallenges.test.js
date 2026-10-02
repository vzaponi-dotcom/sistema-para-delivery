import test from 'node:test'
import assert from 'node:assert/strict'
import { emailAccessFixture, independentEmailClients, EMAIL_BUSINESS as businessId, EMAIL_NOW as now, EMAIL_PASSWORD } from '../test-support/emailAccess.js'
import { issueEmailChallenge, inspectEmailChallenge, completeEmailChallenge, revokeEmailChallenges } from './emailChallenges.js'
import { verifyHumanPassword } from './credentials.js'
import { changeOwnPassword, updateUser } from './users.js'

const password = 'another synthetic river flows safely'
const options = {businessId,userId:'u1',purpose:'password_reset',now}
const bad = {code:'INVALID_EMAIL_CHALLENGE'}
const credential = sqlite => ({...sqlite.prepare("SELECT * FROM user_credentials WHERE user_id='u1'").get()})
const sessions = sqlite => sqlite.prepare("SELECT * FROM sessions WHERE user_id='u1' ORDER BY id").all().map(row => ({...row}))

test('activation verifies email and stores only a token hash without starting a session', async t => {
  const {db,sqlite} = await emailAccessFixture(t,{credential:false})
  const challenge = await issueEmailChallenge(db,{...options,purpose:'activation'})
  assert.match(challenge.token,/^[A-Za-z0-9_-]{43}$/)
  assert.equal(challenge.email,'manager@example.test')
  assert.equal(challenge.expiresAt,'2026-10-03T12:00:00.000Z')
  assert.ok(!JSON.stringify(sqlite.prepare('SELECT * FROM auth_email_challenges').all()).includes(challenge.token))
  const input = {businessId,token:challenge.token,password,now}
  assert.deepEqual(await inspectEmailChallenge(db,input),{purpose:'activation',expiresAt:'2026-10-03T12:00:00.000Z'})
  assert.equal(sqlite.prepare('SELECT consumed_at FROM auth_email_challenges').get().consumed_at,null)
  assert.deepEqual(await completeEmailChallenge(db,input),{completed:true,purpose:'activation'})
  assert.equal(sqlite.prepare("SELECT email_verified_at FROM users WHERE id='u1'").get().email_verified_at,now.toISOString())
  assert.equal(await verifyHumanPassword(password,credential(sqlite).password_verifier),true)
  assert.equal(sessions(sqlite).length,0)
  await assert.rejects(completeEmailChallenge(db,input),bad)
})

test('recovery leaves credentials and sessions intact until one atomic completion', async t => {
  const {db,sqlite} = await emailAccessFixture(t)
  const oldCredential = credential(sqlite), oldSessions = sessions(sqlite)
  const challenge = await issueEmailChallenge(db,options)
  assert.equal(challenge.expiresAt,'2026-10-02T12:30:00.000Z')
  assert.deepEqual(credential(sqlite),oldCredential)
  assert.deepEqual(sessions(sqlite),oldSessions)
  assert.deepEqual(await completeEmailChallenge(db,{businessId,token:challenge.token,password,now}),{completed:true,purpose:'password_reset'})
  assert.equal(await verifyHumanPassword(password,credential(sqlite).password_verifier),true)
  assert.equal(await verifyHumanPassword(EMAIL_PASSWORD,credential(sqlite).password_verifier),false)
  assert.equal(credential(sqlite).revision,2)
  assert.equal(credential(sqlite).version,1)
  assert.ok(sessions(sqlite).every(row => row.revoked_at===now.toISOString()))
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM auth_email_tx_assertions').get().n,0)
})

test('a superseded link and a link from another business cannot be consumed', async t => {
  const {db} = await emailAccessFixture(t)
  const old = await issueEmailChallenge(db,options)
  const fresh = await issueEmailChallenge(db,options)
  await assert.rejects(completeEmailChallenge(db,{businessId,token:old.token,password,now}),bad)
  await assert.rejects(inspectEmailChallenge(db,{businessId:'other',token:fresh.token,now}),bad)
  await assert.rejects(completeEmailChallenge(db,{businessId:'other',token:fresh.token,password,now}),bad)
  assert.equal((await inspectEmailChallenge(db,{businessId,token:fresh.token,now})).purpose,'password_reset')
})

for (const mutation of ["UPDATE users SET active=0 WHERE id='u1'", "UPDATE roles SET active=0 WHERE code='manager'", "UPDATE users SET login_normalized='changed@example.test' WHERE id='u1'", "UPDATE user_credentials SET revision=revision+1 WHERE user_id='u1'"]) {
  test(`completion rechecks eligibility after ${mutation}`, async t => {
    const {db,sqlite} = await emailAccessFixture(t)
    const challenge = await issueEmailChallenge(db,options)
    sqlite.exec(mutation)
    const before = credential(sqlite)
    await assert.rejects(completeEmailChallenge(db,{businessId,token:challenge.token,password,now}),bad)
    assert.deepEqual(credential(sqlite),before)
    assert.equal(sqlite.prepare('SELECT consumed_at FROM auth_email_challenges').get().consumed_at,null)
  })
}

test('expired and malformed challenges cannot inspect or change a password', async t => {
  const {db} = await emailAccessFixture(t)
  const challenge = await issueEmailChallenge(db,options)
  const expired = {...options,token:challenge.token,password,now:new Date('2026-10-02T12:30:00.000Z')}
  await assert.rejects(inspectEmailChallenge(db,expired),bad)
  await assert.rejects(completeEmailChallenge(db,expired),bad)
  await assert.rejects(completeEmailChallenge(db,{...expired,token:'bad'}),bad)
})

test('audit failure rolls back credential, email verification, token and session changes', async t => {
  const {db,sqlite} = await emailAccessFixture(t)
  const challenge = await issueEmailChallenge(db,options)
  const before = credential(sqlite), beforeSessions = sessions(sqlite)
  sqlite.exec("CREATE TRIGGER email_audit_failure BEFORE INSERT ON audit_events WHEN NEW.action LIKE 'access.email.%' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END")
  await assert.rejects(completeEmailChallenge(db,{businessId,token:challenge.token,password,now}),/audit unavailable/)
  assert.deepEqual(credential(sqlite),before)
  assert.deepEqual(sessions(sqlite),beforeSessions)
  assert.equal(sqlite.prepare('SELECT consumed_at FROM auth_email_challenges').get().consumed_at,null)
})

test('two independent database clients cannot consume the same challenge', async t => {
  const {db,sqlite} = await emailAccessFixture(t)
  const challenge = await issueEmailChallenge(db,options)
  const {one,first,second} = independentEmailClients(t,sqlite)
  const input = {businessId,token:challenge.token,password,now}
  const results = await Promise.allSettled([completeEmailChallenge(first,input),completeEmailChallenge(second,input)])
  assert.equal(results.filter(result => result.status==='fulfilled').length,1)
  assert.equal(results.filter(result => result.status==='rejected' && result.reason.code==='INVALID_EMAIL_CHALLENGE').length,1)
  assert.equal(one.prepare("SELECT revision FROM user_credentials WHERE user_id='u1'").get().revision,2)
})

test('own password change revokes issued recovery links and advances credential revision', async t => {
  const {db,sqlite,context} = await emailAccessFixture(t)
  const challenge = await issueEmailChallenge(db,options)
  await changeOwnPassword(db,context,{currentPassword:EMAIL_PASSWORD,password},now)
  assert.equal(credential(sqlite).revision,2)
  assert.ok(sqlite.prepare('SELECT revoked_at FROM auth_email_challenges').get().revoked_at)
  await assert.rejects(completeEmailChallenge(db,{businessId,token:challenge.token,password,now}),bad)
})

test('deactivation and explicit revocation invalidate all links', async t => {
  const {db,sqlite,context} = await emailAccessFixture(t)
  const challenge = await issueEmailChallenge(db,{...options,userId:'operator'})
  await updateUser(db,context,'operator',{active:false},now)
  assert.ok(sqlite.prepare('SELECT revoked_at FROM auth_email_challenges').get().revoked_at)
  await assert.rejects(completeEmailChallenge(db,{businessId,token:challenge.token,password,now}),bad)
  const other = await issueEmailChallenge(db,options)
  await revokeEmailChallenges(db,{businessId,userId:'u1',now})
  await assert.rejects(inspectEmailChallenge(db,{businessId,token:other.token,now}),bad)
})
