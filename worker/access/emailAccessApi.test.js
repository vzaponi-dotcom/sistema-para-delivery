import test from 'node:test'
import assert from 'node:assert/strict'
import { createUser, updateUser, requestCredentialReset, resendInvitation, listUsers } from './users.js'
import { completeEmailChallenge } from './emailChallenges.js'
import { emailAccessFixture, EMAIL_BUSINESS, EMAIL_PASSWORD } from '../test-support/emailAccess.js'

const env={AUTH_EMAIL_ENABLED:'true',RESEND_API_KEY:'synthetic-key',AUTH_EMAIL_FROM:'Mesiva <acesso@example.test>',AUTH_PUBLIC_ORIGIN:'https://staging.example.test'}
const input={displayName:' New person ',email:' PERSON@EXAMPLE.TEST ',roleId:`${EMAIL_BUSINESS}:operator`}
const options=(send)=>({env,deliver:async(_env,challenge)=>{send?.(challenge);return {status:'accepted'}}})

test('manager creates an email invitation with no raw token in account response and canonical duplicate is rejected',async t=>{
  const {db,sqlite,context}=await emailAccessFixture(t)
  let message
  const result=await createUser(db,context,input,new Date(),options(c=>{message=c}))
  assert.equal(result.user.email,'person@example.test');assert.equal(result.user.emailVerified,false);assert.equal(result.user.credentialState,'invited')
  assert.equal(result.delivery.status,'accepted');assert.equal('invite' in result,false);assert.equal(JSON.stringify(result).includes(message.token),false)
  await assert.rejects(createUser(db,context,input,new Date(),options()),{code:'EMAIL_CONFLICT'})
  await assert.rejects(updateUser(db,context,result.user.id,{email:'changed@example.test'}),{code:'INVALID_USER_PATCH'})
  assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM audit_events').all()).includes(message.token),false)
})
test('authenticated resend enforces cooldown and replaces the activation link after sixty seconds',async t=>{
  const {db,context,sqlite}=await emailAccessFixture(t)
  const now=new Date(),created=await createUser(db,context,input,now,options())
  await assert.rejects(resendInvitation(db,context,created.user.id,new Date(now.getTime()+59000),options()),{status:429})
  assert.equal((await resendInvitation(db,context,created.user.id,new Date(now.getTime()+60000),options())).delivery.status,'accepted')
  assert.equal(sqlite.prepare('SELECT count(*) n FROM auth_email_challenges WHERE revoked_at IS NOT NULL').get().n,1)
})
test('an exhausted delivery budget rolls back account creation and every related write',async t=>{
  const {db,sqlite,context}=await emailAccessFixture(t)
  const now=new Date()
  sqlite.prepare('INSERT INTO auth_email_deliveries(id,business_id,user_id,created_at) VALUES(?,?,?,?)').run('previous',EMAIL_BUSINESS,'u1',now.toISOString())
  await assert.rejects(createUser(db,context,input,now,{...options(),env:{...env,AUTH_EMAIL_DAILY_LIMIT:'1'}}),{status:429})
  assert.equal(sqlite.prepare('SELECT count(*) n FROM users').get().n,2)
  assert.equal(sqlite.prepare('SELECT count(*) n FROM auth_email_challenges').get().n,0)
  assert.equal(sqlite.prepare('SELECT count(*) n FROM audit_events').get().n,0)
})
test('operator cannot create resend or reset and issuer authority is rechecked during mutation',async t=>{
  const {db,sqlite,context}=await emailAccessFixture(t)
  const operator={...context,userId:'operator',granted:new Set()}
  await assert.rejects(createUser(db,operator,input,new Date(),options()),{status:403})
  await assert.rejects(resendInvitation(db,operator,'u1',new Date(),options()),{status:403})
  await assert.rejects(requestCredentialReset(db,operator,'u1',new Date(),options()),{status:403})
  for(const mutation of ['issuer','session','grant','role']){
    const f=await emailAccessFixture(t)
    const intercept={...f.db,async batch(statements){
      if(mutation==='issuer')f.sqlite.exec("UPDATE users SET active=0 WHERE id='u1'")
      if(mutation==='session')f.sqlite.exec("UPDATE sessions SET revoked_at='changed' WHERE id='session'")
      if(mutation==='grant')f.sqlite.exec("DELETE FROM role_capabilities WHERE capability='access.users.manage'")
      if(mutation==='role')f.sqlite.exec("UPDATE roles SET active=0 WHERE code='operator'")
      return f.db.batch(statements)
    }}
    await assert.rejects(createUser(intercept,f.context,input,new Date(),options()),error=>error.status>=400,mutation)
    assert.equal(f.sqlite.prepare('SELECT count(*) n FROM users').get().n,2)
    assert.equal(f.sqlite.prepare('SELECT count(*) n FROM auth_email_challenges').get().n,0)
  }
  assert.equal(sqlite.prepare('SELECT count(*) n FROM auth_email_challenges').get().n,0)
})
test('manager reset preserves active credential and sessions until completion including target managers',async t=>{
  const {db,sqlite,context}=await emailAccessFixture(t)
  await assert.rejects(requestCredentialReset(db,context,'u1',new Date(),options()),{code:'OWN_RESET_FORBIDDEN'})
  sqlite.exec(`UPDATE users SET role_id='${EMAIL_BUSINESS}:manager' WHERE id='operator'`)
  let challenge
  const before=sqlite.prepare("SELECT * FROM user_credentials WHERE user_id='operator'").get()
  const result=await requestCredentialReset(db,context,'operator',new Date(),options(c=>{challenge=c}))
  assert.equal(result.user.credentialState,'active');assert.equal(result.user.passwordRecoveryPending,true)
  assert.deepEqual(sqlite.prepare("SELECT * FROM user_credentials WHERE user_id='operator'").get(),before)
  assert.equal((await listUsers(db,context)).users.find(u=>u.id==='operator').passwordRecoveryPending,true)
  await completeEmailChallenge(db,{businessId:EMAIL_BUSINESS,token:challenge.token,password:EMAIL_PASSWORD})
  assert.equal(sqlite.prepare("SELECT revision FROM user_credentials WHERE user_id='operator'").get().revision,2)
})
test('rejected delivery revokes only its challenge; uncertain delivery preserves it and all previous access',async t=>{
  for(const status of ['rejected','uncertain']){
    const {db,sqlite,context}=await emailAccessFixture(t)
    const before=sqlite.prepare("SELECT * FROM user_credentials WHERE user_id='operator'").get()
    const result=await requestCredentialReset(db,context,'operator',new Date(),{env,deliver:async()=>({status})})
    assert.equal(result.delivery.status,status)
    const stored=sqlite.prepare('SELECT * FROM auth_email_challenges').get()
    assert.equal(Boolean(stored.revoked_at),status==='rejected');assert.equal(stored.delivery_status,status)
    assert.deepEqual(sqlite.prepare("SELECT * FROM user_credentials WHERE user_id='operator'").get(),before)
    assert.equal(sqlite.prepare('SELECT count(*) n FROM sessions WHERE revoked_at IS NULL').get().n,2)
  }
})
test('target changed after lookup cannot receive a challenge from a stale mutation',async t=>{
  for(const mutation of ['disable','unverify','credential','role']){
    const {db,sqlite,context}=await emailAccessFixture(t)
    const intercept={...db}
    // The first batch reserves delivery. The second commits the challenge.
    let writes=0
    intercept.batch=async statements=>{writes++;if(writes===2){
      if(mutation==='disable')sqlite.exec("UPDATE users SET active=0 WHERE id='operator'")
      if(mutation==='unverify')sqlite.exec("UPDATE users SET email_verified_at=NULL WHERE id='operator'")
      if(mutation==='credential')sqlite.exec("UPDATE user_credentials SET revision=revision+1 WHERE user_id='operator'")
      if(mutation==='role')sqlite.exec("UPDATE roles SET active=0 WHERE code='operator'")
    }return db.batch(statements)}
    await assert.rejects(requestCredentialReset(intercept,context,'operator',new Date(),options()),error=>error.status>=400)
    assert.equal(sqlite.prepare('SELECT count(*) n FROM auth_email_challenges').get().n,0)
  }
})
