import test from 'node:test'
import assert from 'node:assert/strict'
import { handleEmailAuthApi } from './emailAuthApi.js'
import { handleRequest } from '../index.js'
import { issueEmailChallenge } from './emailChallenges.js'
import { authenticateHumanRequest, createUserSession } from './sessions.js'
import { emailAccessFixture, EMAIL_BUSINESS, EMAIL_PASSWORD } from '../test-support/emailAccess.js'

const config={AUTH_EMAIL_ENABLED:'true',RESEND_API_KEY:'synthetic-key',AUTH_EMAIL_FROM:'Mesiva <acesso@example.test>',AUTH_PUBLIC_ORIGIN:'https://staging.example.test'}
const req=(path,body,origin='https://delivery.test')=>new Request(`https://delivery.test/api/auth/${path}`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)})
const send=async(db,path,body,options={})=>{
  const tasks=[]
  const response=await handleEmailAuthApi(req(path,body),{DB:db,...config},{businessId:EMAIL_BUSINESS,waitUntil:task=>tasks.push(task),...options})
  // Existing state assertions inspect completed work; explicit contexts test early response.
  if(!options.waitUntil)await Promise.all(tasks)
  return response
}

test('email login canonicalizes a verified email and works without Resend configuration',async t=>{
  const {db}=await emailAccessFixture(t)
  const response=await handleRequest(req('login',{email:' MANAGER@EXAMPLE.TEST ',password:EMAIL_PASSWORD,deviceMode:'personal'}),{DB:db})
  assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/Max-Age=604800/)
  assert.equal(response.headers.get('cache-control'),'no-store')
  const cookie=response.headers.get('set-cookie')
  const status=await handleRequest(new Request('https://delivery.test/api/auth/session',{headers:{cookie}}),{DB:db})
  assert.equal((await status.json()).user.email,'manager@example.test')
})
test('login rejects wrong passwords, unconfirmed, disabled, inactive role and identifier-only accounts',async t=>{
  for(const state of ['wrong','unconfirmed','disabled','role','identifier']){
    const {db,sqlite}=await emailAccessFixture(t)
    if(state==='unconfirmed') sqlite.exec("UPDATE users SET email_verified_at=NULL WHERE id='u1'")
    if(state==='disabled') sqlite.exec("UPDATE users SET active=0 WHERE id='u1'")
    if(state==='role') sqlite.exec("UPDATE roles SET active=0 WHERE code='manager'")
    const response=await handleRequest(req('login',state==='identifier'?{identifier:'manager@example.test',password:EMAIL_PASSWORD}:{email:'manager@example.test',password:state==='wrong'?'wrong':EMAIL_PASSWORD}),{DB:db})
    assert.equal(response.status,401,state);assert.equal((await response.json()).error.message,'E-mail ou senha inválidos.')
    assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('cache-control'),'no-store')
  }
})
test('existing login throttle still limits failed email logins',async t=>{
  const {db}=await emailAccessFixture(t)
  for(let i=0;i<5;i++) assert.equal((await handleRequest(req('login',{email:'missing@example.test',password:'wrong'}),{DB:db})).status,401)
  assert.equal((await handleRequest(req('login',{email:'missing@example.test',password:'wrong'}),{DB:db})).status,429)
})
test('public recovery has identical output for eligible missing pending disabled and provider rejection',async t=>{
  const outputs=[]
  for(const state of ['eligible','missing','pending','disabled','rejected']){
    const {db,sqlite,token}=await emailAccessFixture(t)
    if(state==='pending')sqlite.exec("UPDATE users SET email_verified_at=NULL WHERE id='u1'")
    if(state==='disabled')sqlite.exec("UPDATE users SET active=0 WHERE id='u1'")
    const before=sqlite.prepare("SELECT password_verifier FROM user_credentials WHERE user_id='u1'").get()
    const response=await send(db,'password-recovery',{email:state==='missing'?'missing@example.test':'manager@example.test',businessId:'evil'},{fetchImpl:async()=>new Response(JSON.stringify({id:'018f7600-0000-4000-8000-000000000001'}),{status:state==='rejected'?422:200})})
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('set-cookie'),null)
    outputs.push(await response.json())
    assert.deepEqual(sqlite.prepare("SELECT password_verifier FROM user_credentials WHERE user_id='u1'").get(),before)
    if(state!=='disabled'&&state!=='pending')assert.ok(await authenticateHumanRequest(new Request('https://delivery.test',{headers:{cookie:`amor_session=${token}`}}),{DB:db}))
    const challenge=sqlite.prepare('SELECT * FROM auth_email_challenges').get()
    if(state==='rejected')assert.ok(challenge.revoked_at)
    if(state==='eligible')assert.equal(challenge.business_id,EMAIL_BUSINESS)
    if(['missing','pending','disabled'].includes(state))assert.equal(challenge,undefined)
  }
  for(const output of outputs)assert.deepEqual(output,outputs[0])
  assert.equal(outputs[0].message,'Se houver uma conta ativa com esse e-mail, enviaremos um link para redefinir sua senha.')
})
test('public recovery reserves unknown-account quota and configuration failure is uniform',async t=>{
  const {db}=await emailAccessFixture(t)
  for(let i=0;i<3;i++)assert.equal((await send(db,'password-recovery',{email:'missing@example.test'})).status,200)
  assert.equal((await send(db,'password-recovery',{email:'missing@example.test'})).status,429)
  for(const email of ['manager@example.test','missing@example.test']){
    const response=await handleEmailAuthApi(req('password-recovery',{email}),{DB:db},{businessId:EMAIL_BUSINESS})
    assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store')
  }
})
test('public recovery does not use authenticated resend cooldown and hides global delivery exhaustion',async t=>{
  const {db,sqlite}=await emailAccessFixture(t)
  let calls=0
  for(let i=0;i<3;i++)assert.equal((await send(db,'password-recovery',{email:'manager@example.test'},{fetchImpl:async()=>{calls++;return new Response('{}',{status:200})}})).status,200)
  assert.equal(calls,3)
  assert.equal(sqlite.prepare('SELECT count(*) n FROM auth_email_deliveries').get().n,3)
})
test('inspect does not consume or identify the account and completion never creates a session cookie',async t=>{
  const {db,sqlite}=await emailAccessFixture(t,{credential:false})
  const challenge=await issueEmailChallenge(db,{businessId:EMAIL_BUSINESS,userId:'u1',purpose:'activation'})
  const inspection=await send(db,'email-challenges/inspect',{token:challenge.token})
  assert.deepEqual(Object.keys(await inspection.json()).sort(),['expiresAt','purpose']);assert.equal(sqlite.prepare('SELECT consumed_at FROM auth_email_challenges').get().consumed_at,null)
  const response=await send(db,'email-challenges/complete',{token:challenge.token,password:EMAIL_PASSWORD})
  assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('cache-control'),'no-store')
  assert.equal((await send(db,'email-challenges/complete',{token:challenge.token,password:EMAIL_PASSWORD})).status,400)
})
test('every public mutation enforces origin and caches neither failures nor successes',async t=>{
  const {db}=await emailAccessFixture(t)
  for(const path of ['login','password-recovery','email-challenges/inspect','email-challenges/complete']){
    const response=await handleEmailAuthApi(req(path,{email:'manager@example.test'},'https://evil.test'),{DB:db,...config},{businessId:EMAIL_BUSINESS})
    assert.equal(response.status,403);assert.equal(response.headers.get('cache-control'),'no-store')
  }
})
test('existing unverified human sessions and direct session creation remain blocked',async t=>{
  const {db,sqlite,token}=await emailAccessFixture(t)
  sqlite.exec("UPDATE users SET email_verified_at=NULL WHERE id='u1'")
  assert.equal(await authenticateHumanRequest(new Request('https://delivery.test',{headers:{cookie:`amor_session=${token}`}}),{DB:db}),null)
  await assert.rejects(createUserSession({DB:db},{businessId:EMAIL_BUSINESS,userId:'u1'}),{code:'INVALID_LOGIN'})
})
test('recovery cannot change the recipient after the account lookup',async t=>{
  const {db,sqlite}=await emailAccessFixture(t)
  let writes=0,sends=0
  const raced={...db,async batch(statements){writes++;if(writes===2)sqlite.exec("UPDATE users SET login_normalized='changed@example.test' WHERE id='u1'");return db.batch(statements)}}
  const result=await send(raced,'password-recovery',{email:'manager@example.test'},{fetchImpl:async()=>{sends++;return new Response('{}')}})
  assert.equal(result.status,200);assert.equal(sends,0);assert.equal(sqlite.prepare('SELECT count(*) n FROM auth_email_challenges').get().n,0)
})

test('public recovery responds before account lookup and a pending provider, under registered Worker lifetime',async t=>{
  for(const phase of ['lookup','provider'])for(const email of ['manager@example.test','missing@example.test']){
    const {db,sqlite}=await emailAccessFixture(t),tasks=[]
    let releaseLookup,releaseProvider
    const lookupGate=new Promise(resolve=>{releaseLookup=resolve})
    const providerGate=new Promise(resolve=>{releaseProvider=resolve})
    let calls=0,registered=false
    if(phase==='provider')releaseLookup()
    const gated={...db,prepare(sql){
      const statement=db.prepare(sql)
      if(!sql.includes('SELECT u.id,u.display_name,u.role_id,c.revision'))return statement
      return {...statement,bind(...values){const bound=statement.bind(...values);return {...bound,async first(){await lookupGate;return bound.first()}}}}
    }}
    const pending=send(gated,'password-recovery',{email},{waitUntil(task){registered=true;tasks.push(task)},fetchImpl:async()=>{calls++;await providerGate;return new Response(JSON.stringify({id:'018f7600-0000-4000-8000-000000000001'}))}})
    let watchdog
    const outcome=await Promise.race([pending.then(response=>({response})),new Promise(resolve=>{watchdog=setTimeout(()=>resolve({blocked:true}),2000)})])
    clearTimeout(watchdog)
    // Release both gates even on failure, so RED never leaves work or SQLite open.
    releaseLookup();releaseProvider()
    const response=await pending
    await Promise.all(tasks)
    assert.equal(outcome.blocked,undefined,'public response must not await account lookup or delivery')
    assert.equal(registered,true,'recovery work must be registered with Worker lifetime')
    assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null)
    assert.equal((await response.json()).message,'Se houver uma conta ativa com esse e-mail, enviaremos um link para redefinir sua senha.')
    assert.equal(calls,email==='manager@example.test'?1:0)
    assert.equal(sqlite.prepare('SELECT count(*) n FROM auth_email_requests').get().n,1)
  }
})

test('Worker dispatch binds recovery background work and audits failure after a generic response',async t=>{
  const {db,sqlite}=await emailAccessFixture(t),tasks=[]
  const context={waitUntil(task){assert.equal(this,context);tasks.push(task)}}
  const failing={...db,prepare(sql){
    if(sql.includes('SELECT u.id,u.display_name,u.role_id,c.revision'))throw new Error('synthetic-private-details')
    return db.prepare(sql)
  }}
  const response=await handleRequest(req('password-recovery',{email:'manager@example.test'}),{DB:failing,...config},context)
  assert.equal(response.status,200);assert.equal(tasks.length,1)
  assert.equal((await response.json()).message,'Se houver uma conta ativa com esse e-mail, enviaremos um link para redefinir sua senha.')
  await Promise.all(tasks)
  const audits=sqlite.prepare('SELECT action,metadata_json FROM audit_events').all()
  assert.ok(audits.some(event=>event.action==='access.email.password_reset.processing.failure'))
  assert.doesNotMatch(JSON.stringify(audits),/synthetic-private-details|manager@example.test/)
  assert.equal(sqlite.prepare('SELECT count(*) n FROM auth_email_challenges').get().n,0)
})
