import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from '../test-support/settingsDb.js'
import { consumeAccessInvite } from './invitations.js'
import { createSession } from '../auth.js'
import { handleRequest } from '../index.js'
import { preflightCutover, cutoverBusinessAuth, issueInitialManager, issueEmergencyInvite } from './cutover.js'

const businessId='amor-e-sabor', now=new Date(), password='a quiet river flows'
async function setup(t,activate=true) {
  const fixture=createSettingsDb();t.after(fixture.close)
  const invite=await issueInitialManager(fixture.db,businessId,{identifier:' MANAGER@EXAMPLE.TEST ',displayName:'Manager'},now)
  if(activate){
    await consumeAccessInvite(fixture.db,{token:invite.token,password,businessId,now})
    // Historical infrastructure invites do not verify email. A verified fixture
    // is explicitly required for the new cutover readiness contract.
    fixture.sqlite.prepare('UPDATE users SET email_verified_at=?').run(now.toISOString())
  }
  return {...fixture,invite}
}
test('initial manager enrollment is atomic, hash only, reissues pending invitation and cannot claim activated account',async t=>{
  const {db,sqlite,invite}=await setup(t,false)
  assert.equal(sqlite.prepare('SELECT mode FROM business_auth_state').get().mode,'enrollment')
  assert.equal(sqlite.prepare('SELECT count(*) n FROM user_credentials').get().n,0)
  assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM access_invites').all()).includes(invite.token),false)
  const second=await issueInitialManager(db,businessId,{identifier:'manager@example.test',displayName:'Manager'},now)
  assert.equal(invite.userId,second.userId)
  await assert.rejects(consumeAccessInvite(db,{token:invite.token,password,businessId,now}))
  await consumeAccessInvite(db,{token:second.token,password,businessId,now})
  await assert.rejects(issueInitialManager(db,businessId,{identifier:'other',displayName:'Other'},now))
  await assert.rejects(issueInitialManager(db,businessId,{identifier:'manager@example.test',displayName:'Manager'},now))
  assert.equal(sqlite.prepare('SELECT count(*) n FROM users').get().n,1)
})
test('preflight rejects absent managers, incomplete or unsupported verifiers and missing persisted grants',async t=>{
  const {db,sqlite,invite}=await setup(t,false)
  assert.equal((await preflightCutover(db,businessId)).ready,false)
  await assert.rejects(cutoverBusinessAuth(db,businessId,now))
  await consumeAccessInvite(db,{token:invite.token,password,businessId,now})
  assert.equal((await preflightCutover(db,businessId)).ready,false)
  sqlite.prepare('UPDATE users SET email_verified_at=?').run(now.toISOString())
  assert.deepEqual(await preflightCutover(db,businessId),{ready:true,failures:[]})
  const original=sqlite.prepare('SELECT password_verifier FROM user_credentials').get().password_verifier
  for(const invalid of ['bad',original.replace('100000','99999'),original+'$extra',original.replace('==','$=')]) {
    sqlite.prepare('UPDATE user_credentials SET password_verifier=?').run(invalid)
    assert.equal((await preflightCutover(db,businessId)).ready,false)
    await assert.rejects(cutoverBusinessAuth(db,businessId,now))
  }
  sqlite.prepare('UPDATE user_credentials SET password_verifier=?').run(original)
  sqlite.exec("DELETE FROM role_capabilities WHERE capability='orders.create'")
  assert.equal((await preflightCutover(db,businessId)).ready,false)
  await assert.rejects(cutoverBusinessAuth(db,businessId,now))
  assert.equal(sqlite.prepare('SELECT mode FROM business_auth_state').get().mode,'enrollment')
})
test('cutover atomically revokes legacy sessions, denies PIN, and concurrent retries produce one audit event',async t=>{
  const {db,sqlite}=await setup(t)
  await createSession({DB:db},businessId,now)
  await Promise.all([cutoverBusinessAuth(db,businessId,now),cutoverBusinessAuth(db,businessId,now)])
  assert.equal(sqlite.prepare('SELECT mode FROM business_auth_state').get().mode,'user_only')
  assert.equal(sqlite.prepare('SELECT count(*) n FROM sessions WHERE user_id IS NULL AND revoked_at IS NULL').get().n,0)
  assert.equal(sqlite.prepare("SELECT count(*) n FROM audit_events WHERE action='access.auth.cutover'").get().n,1)
  const response=await handleRequest(new Request('https://delivery.test/api/auth/login',{method:'POST',headers:{origin:'https://delivery.test','content-type':'application/json'},body:JSON.stringify({pin:'1234'})}),{DB:db})
  assert.equal(response.status,401)
})
test('guard rechecks credentials and grants inside batch, and audit failure rolls back mode and revocation',async t=>{
  for(const sabotage of ["DELETE FROM role_capabilities WHERE capability='orders.create'",'UPDATE user_credentials SET active=0',"UPDATE user_credentials SET password_verifier='corrupt'",'UPDATE users SET active=0','UPDATE roles SET active=0','UPDATE user_credentials SET version=2']) {
    const {db,sqlite}=await setup(t);await createSession({DB:db},businessId,now)
    const raced={...db,batch:async statements=>{sqlite.exec(sabotage);return db.batch(statements)}}
    await assert.rejects(cutoverBusinessAuth(raced,businessId,now))
    assert.equal(sqlite.prepare('SELECT mode FROM business_auth_state').get().mode,'enrollment')
    assert.equal(sqlite.prepare('SELECT revoked_at FROM sessions').get().revoked_at,null)
  }
  const {db,sqlite}=await setup(t);await createSession({DB:db},businessId,now)
  sqlite.exec("CREATE TRIGGER fail_cutover BEFORE INSERT ON audit_events WHEN NEW.action='access.auth.cutover' BEGIN SELECT RAISE(ABORT,'injected'); END")
  await assert.rejects(cutoverBusinessAuth(db,businessId,now))
  assert.equal(sqlite.prepare('SELECT mode FROM business_auth_state').get().mode,'enrollment')
  assert.equal(sqlite.prepare('SELECT revoked_at FROM sessions').get().revoked_at,null)
})
test('emergency recovery for last manager is audited, revokes credential, allows reissue and one acceptance without PIN rollback',async t=>{
  const {db,sqlite,invite}=await setup(t);await cutoverBusinessAuth(db,businessId,now)
  const first=await issueEmergencyInvite(db,businessId,invite.userId,now)
  assert.equal(sqlite.prepare('SELECT active FROM user_credentials').get().active,0)
  const second=await issueEmergencyInvite(db,businessId,invite.userId,now)
  await assert.rejects(consumeAccessInvite(db,{token:first.token,password,businessId,now}))
  await consumeAccessInvite(db,{token:second.token,password,businessId,now})
  await assert.rejects(consumeAccessInvite(db,{token:second.token,password,businessId,now}))
  assert.equal(sqlite.prepare('SELECT mode FROM business_auth_state').get().mode,'user_only')
  const event=sqlite.prepare("SELECT * FROM audit_events WHERE action='access.invitation.emergency'").get()
  assert.equal(event.actor_type,'system');assert.equal(event.resource_id,invite.userId)
  assert.equal(JSON.stringify(event).includes(second.token),false)
  await assert.rejects(issueEmergencyInvite(db,businessId,'foreign',now))
})

test('initial and emergency audit failures roll back all official writes, including role seeds and credential/session revocation',async t=>{
  const fresh=createSettingsDb();t.after(fresh.close)
  fresh.sqlite.exec("CREATE TRIGGER fail_initial BEFORE INSERT ON audit_events WHEN NEW.action='access.invitation.initial' BEGIN SELECT RAISE(ABORT,'injected'); END")
  await assert.rejects(issueInitialManager(fresh.db,businessId,{identifier:'manager',displayName:'Manager'},now))
  assert.equal(fresh.sqlite.prepare('SELECT mode FROM business_auth_state').get().mode,'legacy')
  for(const table of ['roles','role_capabilities','users','access_invites','audit_events']) assert.equal(fresh.sqlite.prepare(`SELECT count(*) n FROM ${table}`).get().n,0)
  const {db,sqlite,invite}=await setup(t)
  sqlite.prepare(`INSERT INTO sessions(id,business_id,token_hash,created_at,expires_at,last_seen_at,user_id,device_mode)
    VALUES('human',?,'digest',?,?,?,?,'shared')`).run(businessId,now.toISOString(),new Date(now.getTime()+3600000).toISOString(),now.toISOString(),invite.userId)
  sqlite.exec("CREATE TRIGGER fail_emergency BEFORE INSERT ON audit_events WHEN NEW.action='access.invitation.emergency' BEGIN SELECT RAISE(ABORT,'injected'); END")
  await assert.rejects(issueEmergencyInvite(db,businessId,invite.userId,now))
  assert.equal(sqlite.prepare('SELECT active FROM user_credentials').get().active,1)
  assert.equal(sqlite.prepare('SELECT revoked_at FROM sessions').get().revoked_at,null)
  assert.equal(sqlite.prepare('SELECT count(*) n FROM access_invites').get().n,1)
})

test('preflight rejects elevated operator grants but ignores retired/unknown rows and refuses credential version drift',async t=>{
  const {db,sqlite}=await setup(t)
  sqlite.exec("INSERT INTO role_capabilities VALUES('amor-e-sabor','amor-e-sabor:operator','clients.manage')")
  assert.equal((await preflightCutover(db,businessId)).ready,true)
  sqlite.exec("INSERT INTO role_capabilities VALUES('amor-e-sabor','amor-e-sabor:operator','access.users.manage')")
  assert.equal((await preflightCutover(db,businessId)).ready,false)
  sqlite.exec("DELETE FROM role_capabilities WHERE role_id='amor-e-sabor:operator' AND capability='access.users.manage'; UPDATE user_credentials SET version=2")
  assert.equal((await preflightCutover(db,businessId)).ready,false)
  await assert.rejects(cutoverBusinessAuth(db,businessId,now))
})
