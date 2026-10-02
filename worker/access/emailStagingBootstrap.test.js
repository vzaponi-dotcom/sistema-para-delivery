import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareStagingEmailManager,finalizeStagingEmailAccounts } from './emailStagingBootstrap.js'
import { completeEmailChallenge,inspectEmailChallenge,issueEmailChallenge } from './emailChallenges.js'
import { issueEmergencyInvite } from './cutover.js'
import { emailAccessFixture,EMAIL_BUSINESS,EMAIL_NOW,EMAIL_PASSWORD } from '../test-support/emailAccess.js'

const options={businessId:EMAIL_BUSINESS,name:'New manager',email:'new-manager@example.test',now:EMAIL_NOW}
test('preparation resumes the same pending account, snapshots old IDs and leaves old access untouched',async t=>{
  const {db,sqlite}=await emailAccessFixture(t)
  const before=sqlite.prepare('SELECT * FROM user_credentials ORDER BY user_id').all()
  const first=await prepareStagingEmailManager(db,options)
  const second=await prepareStagingEmailManager(db,{...options,now:new Date(EMAIL_NOW.getTime()+60000)})
  assert.equal(first.userId,second.userId);assert.equal(sqlite.prepare('SELECT count(*) n FROM users').get().n,3)
  const record=sqlite.prepare('SELECT * FROM auth_email_staging_bootstraps').get()
  assert.deepEqual(JSON.parse(record.previous_user_ids_json).sort(),['operator','u1'])
  assert.deepEqual(sqlite.prepare('SELECT * FROM user_credentials ORDER BY user_id').all(),before)
  assert.equal(sqlite.prepare('SELECT mode FROM business_auth_state').get().mode,'user_only')
  await assert.rejects(inspectEmailChallenge(db,{businessId:EMAIL_BUSINESS,token:first.challenge.token,now:EMAIL_NOW}))
  assert.equal(JSON.stringify(record).includes(second.challenge.token),false)
})
test('finalization refuses pending inactive or grantless managers without changing old accounts',async t=>{
  for(const condition of ['pending','inactive','grantless','corrupt','wrong-id']){
    const {db,sqlite}=await emailAccessFixture(t)
    const prepared=await prepareStagingEmailManager(db,options)
    if(condition!=='pending')await completeEmailChallenge(db,{businessId:EMAIL_BUSINESS,token:prepared.challenge.token,password:EMAIL_PASSWORD,now:EMAIL_NOW})
    if(condition==='inactive')sqlite.prepare('UPDATE users SET active=0 WHERE id=?').run(prepared.userId)
    if(condition==='grantless')sqlite.exec("DELETE FROM role_capabilities WHERE capability='access.users.manage'")
    if(condition==='corrupt')sqlite.prepare("UPDATE user_credentials SET password_verifier='corrupt' WHERE user_id=?").run(prepared.userId)
    await assert.rejects(finalizeStagingEmailAccounts(db,{businessId:EMAIL_BUSINESS,managerId:condition==='wrong-id'?'u1':prepared.userId,now:EMAIL_NOW}),{code:'STAGING_EMAIL_NOT_READY'})
    assert.equal(sqlite.prepare("SELECT count(*) n FROM users WHERE id IN ('u1','operator') AND active=1").get().n,2)
    assert.equal(sqlite.prepare('SELECT finalized_at FROM auth_email_staging_bootstraps').get().finalized_at,null)
  }
})
test('finalization revokes only the recorded fictional accounts, preserves references and is idempotent',async t=>{
  const {db,sqlite}=await emailAccessFixture(t)
  const oldChallenge=await issueEmailChallenge(db,{businessId:EMAIL_BUSINESS,userId:'u1',purpose:'password_reset',now:EMAIL_NOW})
  sqlite.prepare("INSERT INTO audit_events(id,business_id,occurred_at,actor_type,actor_user_id,actor_name,action,result) VALUES('history',?,?,'user','u1','Original manager','fixture','success')").run(EMAIL_BUSINESS,EMAIL_NOW.toISOString())
  const prepared=await prepareStagingEmailManager(db,options)
  await completeEmailChallenge(db,{businessId:EMAIL_BUSINESS,token:prepared.challenge.token,password:EMAIL_PASSWORD,now:EMAIL_NOW})
  const confirmedBefore=sqlite.prepare('SELECT * FROM user_credentials WHERE user_id=?').get(prepared.userId)
  const resumed=await prepareStagingEmailManager(db,{...options,now:new Date(EMAIL_NOW.getTime()+60000)})
  assert.equal(resumed.userId,prepared.userId);assert.equal(resumed.activated,true);assert.equal(resumed.challenge,undefined)
  assert.deepEqual(sqlite.prepare('SELECT * FROM user_credentials WHERE user_id=?').get(prepared.userId),confirmedBefore)
  sqlite.prepare(`INSERT INTO users(id,business_id,display_name,login_normalized,role_id,created_at,updated_at) VALUES('later',?,'Later','later@example.test',?,?,?)`).run(EMAIL_BUSINESS,`${EMAIL_BUSINESS}:operator`,EMAIL_NOW.toISOString(),EMAIL_NOW.toISOString())
  await finalizeStagingEmailAccounts(db,{businessId:EMAIL_BUSINESS,managerId:prepared.userId,now:EMAIL_NOW})
  const auditCount=sqlite.prepare('SELECT count(*) n FROM audit_events').get().n
  await finalizeStagingEmailAccounts(db,{businessId:EMAIL_BUSINESS,managerId:prepared.userId,now:EMAIL_NOW})
  assert.equal(sqlite.prepare('SELECT count(*) n FROM audit_events').get().n,auditCount)
  assert.equal(sqlite.prepare('SELECT active FROM users WHERE id=?').get(prepared.userId).active,1)
  assert.equal(sqlite.prepare("SELECT active FROM users WHERE id='later'").get().active,1)
  assert.equal(sqlite.prepare("SELECT count(*) n FROM users WHERE id IN ('u1','operator') AND active=0").get().n,2)
  assert.equal(sqlite.prepare("SELECT count(*) n FROM user_credentials WHERE user_id IN ('u1','operator') AND active=0").get().n,2)
  assert.equal(sqlite.prepare("SELECT count(*) n FROM sessions WHERE user_id='u1' AND revoked_at IS NULL").get().n,0)
  await assert.rejects(inspectEmailChallenge(db,{businessId:EMAIL_BUSINESS,token:oldChallenge.token,now:EMAIL_NOW}))
  assert.equal(sqlite.prepare("SELECT actor_user_id FROM audit_events WHERE id='history'").get().actor_user_id,'u1')
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[])
})
test('finalization guard detects credential/grant drift at commit and audit failures roll back every official mutation',async t=>{
  for(const condition of ['race','audit']){
    const {db,sqlite}=await emailAccessFixture(t)
    const prepared=await prepareStagingEmailManager(db,options)
    await completeEmailChallenge(db,{businessId:EMAIL_BUSINESS,token:prepared.challenge.token,password:EMAIL_PASSWORD,now:EMAIL_NOW})
    if(condition==='audit')sqlite.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'injected'); END")
    const raced=condition==='race'?{...db,async batch(statements){sqlite.exec("DELETE FROM role_capabilities WHERE capability='access.users.manage'");return db.batch(statements)}}:db
    await assert.rejects(finalizeStagingEmailAccounts(raced,{businessId:EMAIL_BUSINESS,managerId:prepared.userId,now:EMAIL_NOW}))
    assert.equal(sqlite.prepare("SELECT active FROM users WHERE id='u1'").get().active,1)
    assert.equal(sqlite.prepare("SELECT active FROM user_credentials WHERE user_id='u1'").get().active,1)
    assert.equal(sqlite.prepare("SELECT count(*) n FROM sessions WHERE revoked_at IS NULL").get().n,2)
    assert.equal(sqlite.prepare('SELECT finalized_at FROM auth_email_staging_bootstraps').get().finalized_at,null)
  }
})
test('emergency recovery uses a private email-family link only for a verified usable manager and preserves current access',async t=>{
  const {db,sqlite,verifier}=await emailAccessFixture(t)
  const competing=await issueEmailChallenge(db,{businessId:EMAIL_BUSINESS,userId:'u1',purpose:'password_reset',now:EMAIL_NOW})
  const emergency=await issueEmergencyInvite(db,EMAIL_BUSINESS,'u1',EMAIL_NOW)
  assert.equal(emergency.expiresAt,'2026-10-02T12:30:00.000Z')
  assert.equal(sqlite.prepare("SELECT password_verifier FROM user_credentials WHERE user_id='u1'").get().password_verifier,verifier)
  assert.equal(sqlite.prepare("SELECT active FROM user_credentials WHERE user_id='u1'").get().active,1)
  assert.equal(sqlite.prepare('SELECT count(*) n FROM sessions WHERE revoked_at IS NULL').get().n,2)
  assert.equal(sqlite.prepare('SELECT delivery_status FROM auth_email_challenges WHERE revoked_at IS NULL').get().delivery_status,'private')
  await assert.rejects(inspectEmailChallenge(db,{businessId:EMAIL_BUSINESS,token:competing.token,now:EMAIL_NOW}))
  await completeEmailChallenge(db,{businessId:EMAIL_BUSINESS,token:emergency.token,password:EMAIL_PASSWORD,now:EMAIL_NOW})
  assert.equal(sqlite.prepare("SELECT revision FROM user_credentials WHERE user_id='u1'").get().revision,2)
  assert.equal(sqlite.prepare('SELECT count(*) n FROM sessions WHERE revoked_at IS NULL').get().n,0)
  await assert.rejects(issueEmergencyInvite(db,EMAIL_BUSINESS,'operator',EMAIL_NOW))
  sqlite.exec("UPDATE users SET email_verified_at=NULL WHERE id='u1'")
  await assert.rejects(issueEmergencyInvite(db,EMAIL_BUSINESS,'u1',EMAIL_NOW))
})
