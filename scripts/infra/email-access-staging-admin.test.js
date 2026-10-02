import test from 'node:test'
import assert from 'node:assert/strict'
import { runEmailStagingAdmin } from './email-access-staging-admin.mjs'
import { emailAccessFixture,EMAIL_CONFIG,EMAIL_BUSINESS,EMAIL_PASSWORD } from '../../worker/test-support/emailAccess.js'
import { completeEmailChallenge } from '../../worker/access/emailChallenges.js'

test('staging CLI rejects production, missing env, arbitrary tenant and secrets in arguments before connecting',async()=>{
  let connections=0
  const deps={connect:async()=>{connections++;assert.fail('no connection')},env:EMAIL_CONFIG,log:()=>{}}
  for(const args of [[],['prepare-manager','--name','Name','--email','test@example.test'],['prepare-manager','--env','production','--name','Name','--email','test@example.test'],['finalize-accounts','--env','local','--manager-id','u1'],['prepare-manager','--env','staging','--name','Name','--email','test@example.test','--password','secret'],['finalize-accounts','--env','staging','--manager-id','u1','--business-id','evil']])await assert.rejects(runEmailStagingAdmin(args,deps))
  assert.equal(connections,0)
})
test('staging CLI delivers after commit, logs no token/email body, disposes and only finalizes a confirmed manager',async t=>{
  const {db,sqlite}=await emailAccessFixture(t),logs=[]
  let disposed=0,challenge
  const deps={connect:async()=>({db,dispose:async()=>{disposed++}}),env:EMAIL_CONFIG,log:line=>logs.push(line),deliver:async(_env,data)=>{
    challenge=data
    assert.ok(sqlite.prepare('SELECT id FROM auth_email_challenges WHERE id=?').get(data.challengeId))
    return {status:'uncertain'}
  }}
  const first=await runEmailStagingAdmin(['prepare-manager','--env','staging','--name','New manager','--email','new-manager@example.test'],deps)
  assert.equal(first.delivery.status,'uncertain');assert.equal(disposed,1)
  assert.equal(JSON.stringify(logs).includes(challenge.token),false)
  assert.equal(JSON.stringify(logs).includes('new-manager@example.test'),false)
  await assert.rejects(runEmailStagingAdmin(['finalize-accounts','--env','staging','--manager-id',first.userId],deps))
  assert.equal(sqlite.prepare("SELECT active FROM users WHERE id='u1'").get().active,1)
  await completeEmailChallenge(db,{businessId:EMAIL_BUSINESS,token:challenge.token,password:EMAIL_PASSWORD})
  await runEmailStagingAdmin(['finalize-accounts','--env','staging','--manager-id',first.userId],deps)
  assert.equal(sqlite.prepare("SELECT active FROM users WHERE id='u1'").get().active,0)
  assert.equal(disposed,3)
})
