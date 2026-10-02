import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from '../test-support/settingsDb.js'
import { seedBuiltinRoles } from './roles.js'
import { hashHumanPassword } from './credentials.js'
import { createUserSession } from './sessions.js'
import { handleRequest } from '../index.js'
import { EMAIL_CONFIG } from '../test-support/emailAccess.js'

const businessId='amor-e-sabor',password='a quiet river flows'
async function setup(t,role='manager',deviceMode='shared'){
  const fixture=createSettingsDb();t.after(fixture.close)
  const {db,sqlite}=fixture,now=new Date(),timestamp=now.toISOString()
  await seedBuiltinRoles(db,businessId,now)
  sqlite.exec("UPDATE business_auth_state SET mode='user_only'")
  sqlite.prepare(`INSERT INTO users(id,business_id,display_name,login_normalized,role_id,email_verified_at,created_at,updated_at) VALUES('user',?,'Person','person@example.test',?,?,?,?)`).run(businessId,`${businessId}:${role}`,timestamp,timestamp,timestamp)
  sqlite.prepare(`INSERT INTO user_credentials(business_id,user_id,password_verifier,password_changed_at,created_at,updated_at) VALUES(?,'user',?,?,?,?)`).run(businessId,await hashHumanPassword(password),timestamp,timestamp,timestamp)
  const session=await createUserSession({DB:db},{businessId,userId:'user',deviceMode})
  return {...fixture,session}
}
const req=(token,path,method='GET',body,origin='https://delivery.test')=>new Request(`https://delivery.test${path}`,{method,headers:{cookie:`amor_session=${token}`,origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})

test('actual access endpoints enforce grants same origin and manager creation',async(t)=>{
  const {db,session}=await setup(t)
  t.mock.method(globalThis,'fetch',async url=>{assert.equal(url,'https://api.resend.com/emails');return new Response('{}',{status:200})})
  assert.equal((await handleRequest(req(session.token,'/api/access/users'),{DB:db})).status,200)
  const body={displayName:'Joana',email:'joana@example.test',roleId:`${businessId}:operator`,businessId:'evil'}
  assert.equal((await handleRequest(req(session.token,'/api/access/users','POST',body,'https://evil.test'),{DB:db})).status,403)
  const created=await handleRequest(req(session.token,'/api/access/users','POST',body),{DB:db,...EMAIL_CONFIG})
  assert.equal(created.status,201);assert.equal(created.headers.get('cache-control'),'no-store')
  const payload=await created.json(),{user}=payload;assert.equal(payload.delivery.status,'accepted');assert.equal('invite' in payload,false)
  assert.equal((await handleRequest(req(session.token,`/api/access/users/${user.id}`,'PATCH',{displayName:'Renamed'}),{DB:db})).status,200)
  assert.equal((await handleRequest(req(session.token,`/api/access/users/${user.id}/resend-invite`,'POST',{}),{DB:db,...EMAIL_CONFIG})).status,429)
  assert.equal((await handleRequest(req(session.token,'/api/access/users/user/reset','POST',{}),{DB:db})).status,403)
})

test('operator cannot list or mutate team but can rotate own password with shared or personal expiration',async(t)=>{
  for(const [mode,maxAge] of [['shared',43200],['personal',604800]]){
    const {db,session,sqlite}=await setup(t,'operator',mode)
    const other=await createUserSession({DB:db},{businessId,userId:'user',deviceMode:mode})
    assert.equal((await handleRequest(req(session.token,'/api/access/users'),{DB:db})).status,403)
    assert.equal((await handleRequest(req(session.token,'/api/access/users','POST',{}),{DB:db})).status,403)
    const malformed=req(session.token,'/api/access/users','POST',{})
    assert.equal((await handleRequest(new Request(malformed.url,{method:'POST',headers:malformed.headers,body:'invalid json'}),{DB:db})).status,403)
    const response=await handleRequest(req(session.token,'/api/access/me/password','POST',{currentPassword:password,password:'another quiet river'}),{DB:db})
    assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),new RegExp(`Max-Age=${maxAge}`))
    const token=response.headers.get('set-cookie').match(/^amor_session=([^;]+)/)[1]
    for(const stale of [session.token,other.token]) assert.equal((await handleRequest(req(stale,'/api/access/me/password','POST',{currentPassword:password,password:'one more quiet river'}),{DB:db})).status,401)
    const status=await handleRequest(req(token,'/api/auth/session'),{DB:db})
    assert.equal((await status.json()).authenticated,true)
    assert.equal(sqlite.prepare('SELECT count(*) n FROM sessions WHERE revoked_at IS NULL').get().n,1)
    const audit=JSON.stringify(sqlite.prepare('SELECT * FROM audit_events').all())
    for(const secret of [password,'another quiet river',token]) assert.equal(audit.includes(secret),false)
  }
})
