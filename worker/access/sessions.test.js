import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from '../test-support/settingsDb.js'
import { seedBuiltinRoles } from './roles.js'
import { hashHumanPassword } from './credentials.js'
import { createUserSession, authenticateHumanRequest, revokeUserSessions, prepareUserSessionRevocation } from './sessions.js'
import { createSession, revokeSession } from '../auth.js'
import { handleRequest } from '../index.js'

const businessId = 'amor-e-sabor'
const now = new Date('2026-09-30T12:00:00.000Z')
const password = 'a quiet river flows'
async function setup(t, mode = 'user_only') {
  const fixture = createSettingsDb(); t.after(fixture.close)
  await seedBuiltinRoles(fixture.db, businessId, now)
  fixture.sqlite.prepare('UPDATE business_auth_state SET mode = ?').run(mode)
  fixture.sqlite.prepare(`INSERT INTO users (id,business_id,display_name,login_normalized,role_id,created_at,updated_at)
    VALUES ('user',?,'Person','person',?,?,?)`).run(businessId, `${businessId}:manager`, now.toISOString(), now.toISOString())
  fixture.sqlite.prepare(`INSERT INTO user_credentials (business_id,user_id,password_verifier,password_changed_at,created_at,updated_at)
    VALUES (?,'user',?,?,?,?)`).run(businessId, await hashHumanPassword(password), now.toISOString(), now.toISOString(), now.toISOString())
  return fixture
}
const req = (token, path = '/api/auth/session', method = 'GET', body) => new Request(`https://delivery.test${path}`, {
  method, headers: { cookie: `amor_session=${token}`, origin: 'https://delivery.test', 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
test('shared and personal sessions expire absolutely at 12 hours and seven days with opaque digests', async (t) => {
  const { db, sqlite } = await setup(t)
  for (const [deviceMode, expected] of [['shared','2026-10-01T00:00:00.000Z'],['personal','2026-10-07T12:00:00.000Z']]) {
    const session = await createUserSession({ DB: db }, { businessId, userId: 'user', deviceMode, now })
    assert.equal(session.expiresAt, expected)
    assert.ok(await authenticateHumanRequest(req(session.token), { DB: db }, new Date(new Date(expected).getTime()-1)))
    assert.equal(await authenticateHumanRequest(req(session.token), { DB: db }, new Date(expected)), null)
    assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM sessions').all()).includes(session.token), false)
  }
})
test('active account credential and role plus current known grants are revalidated', async (t) => {
  const { db, sqlite } = await setup(t)
  const { token } = await createUserSession({ DB: db }, { businessId, userId: 'user', now })
  let context = await authenticateHumanRequest(req(token), { DB: db }, now)
  assert.equal(context.deviceMode, 'shared'); assert.equal(context.displayName, 'Person')
  sqlite.exec("DELETE FROM role_capabilities WHERE capability = 'orders.create'; INSERT INTO role_capabilities VALUES ('amor-e-sabor','amor-e-sabor:manager','unknown.grant')")
  context = await authenticateHumanRequest(req(token), { DB: db }, now)
  assert.equal(context.granted.has('orders.create'), false); assert.equal(context.granted.has('unknown.grant'), false)
  for (const table of ['users','user_credentials','roles']) {
    sqlite.exec(`UPDATE ${table} SET active = 0`)
    assert.equal(await authenticateHumanRequest(req(token), { DB: db }, now), null)
    sqlite.exec(`UPDATE ${table} SET active = 1`)
  }
})
test('voluntary logout revokes one device and reset revocation revokes every device', async (t) => {
  const { db } = await setup(t)
  const options = { businessId, userId: 'user', now }
  const first = await createUserSession({ DB: db }, options); const second = await createUserSession({ DB: db }, options)
  await revokeSession(req(first.token), { DB: db }, now)
  assert.equal(await authenticateHumanRequest(req(first.token), { DB: db }, now), null)
  assert.ok(await authenticateHumanRequest(req(second.token), { DB: db }, now))
  await revokeUserSessions(db, businessId, 'user', now)
  assert.equal(await authenticateHumanRequest(req(second.token), { DB: db }, now), null)
})
test('user_only denies legacy sessions while explicit enrollment keeps legacy without access grants', async (t) => {
  const { db, sqlite } = await setup(t)
  const { token } = await createSession({ DB: db }, businessId, now)
  assert.equal(await authenticateHumanRequest(req(token), { DB: db }, now), null)
  sqlite.exec("UPDATE business_auth_state SET mode = 'enrollment'")
  const legacy = await authenticateHumanRequest(req(token), { DB: db }, now)
  assert.equal(legacy.granted.has('orders.create'), true); assert.equal(legacy.granted.has('access.users.manage'), false)
})
test('enrollment user has access grants but cannot reach operational routes including unguarded clients', async (t) => {
  const { db } = await setup(t, 'enrollment')
  const { token } = await createUserSession({ DB: db }, { businessId, userId: 'user' })
  const status = await handleRequest(req(token), { DB: db })
  const body = await status.json()
  assert.deepEqual(body.user, { id: 'user', displayName: 'Person', roleName: 'Gerente' })
  assert.ok(body.capabilities.includes('access.users.manage')); assert.equal(body.capabilities.includes('orders.create'), false)
  for (const [path,method,payload] of [['/api/orders','GET'],['/api/clients','POST',{name:'Denied'}],['/api/bootstrap','GET']]) {
    assert.equal((await handleRequest(req(token,path,method,payload), { DB: db })).status, 403)
  }
})
test('human login is non-enumerating, ignores browser business and logs secret-free outcomes', async (t) => {
  const { db, sqlite } = await setup(t)
  const login = (identifier, value = password) => handleRequest(req('', '/api/auth/login', 'POST', { identifier, password: value, businessId:'other' }), { DB: db })
  const absent = await login('absent','wrong'); const wrong = await login('person','wrong')
  assert.equal(absent.status,401); assert.deepEqual(await absent.json(), await wrong.json())
  const success = await login(' PERSON ')
  assert.equal(success.status,200); assert.match(success.headers.get('set-cookie'), /Max-Age=43200/)
  assert.equal((await success.json()).businessId,businessId)
  const persisted = JSON.stringify(sqlite.prepare('SELECT * FROM audit_events').all())
  assert.match(persisted,/login.success/); assert.match(persisted,/login.failure/)
  for (const secret of [password,'absent','PERSON','wrong']) assert.equal(persisted.includes(secret),false)
  assert.equal((await handleRequest(req('', '/api/auth/login','POST',{pin:'4827'}), { DB: db })).status,401)
})

test('revocation while a mutation is in flight prevents its response without replaying accepted effects', async (t) => {
  const { db, sqlite } = await setup(t)
  const { token } = await createUserSession({ DB: db }, { businessId, userId: 'user' })
  const intercept = { ...db, prepare(sql) {
    const statement = db.prepare(sql)
    if (!sql.includes('INSERT INTO clients')) return statement
    return { bind(...values) {
      const bound = statement.bind(...values)
      return { ...bound, async run() {
        const result = await bound.run()
        await revokeUserSessions(db, businessId, 'user')
        return result
      } }
    } }
  } }
  const response = await handleRequest(req(token,'/api/clients','POST',{name:'Accepted'}), { DB: intercept })
  assert.equal(response.status,401)
  assert.equal(sqlite.prepare("SELECT count(*) n FROM clients WHERE name='Accepted'").get().n,1)
})

test('prepared revocation rolls back with failed official writes and password verifier races cannot issue sessions', async (t) => {
  const { db, sqlite } = await setup(t)
  const { token } = await createUserSession({ DB: db }, { businessId, userId:'user',now })
  await assert.rejects(db.batch([prepareUserSessionRevocation(db,businessId,'user',now),db.prepare('INSERT INTO missing VALUES (1)')]))
  assert.ok(await authenticateHumanRequest(req(token),{DB:db},now))
  await assert.rejects(createUserSession({DB:db},{businessId,userId:'user',credentialVerifier:'stale-verifier',now}),{status:401})
  assert.equal(sqlite.prepare('SELECT count(*) n FROM sessions').get().n,1)
})

test('unknown accounts are blocked by the same persisted quota and emit a secret-free block event', async(t)=>{
  const {db,sqlite}=await setup(t)
  const attempt = () => handleRequest(req('','/api/auth/login','POST',{identifier:'unknown',password:'wrong'}),{DB:db})
  for(let i=0;i<5;i++) assert.equal((await attempt()).status,401)
  const blocked=await attempt();assert.equal(blocked.status,429)
  assert.equal(sqlite.prepare("SELECT count(*) n FROM audit_events WHERE action='login.blocked'").get().n,1)
  assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM audit_events').all()).includes('unknown'),false)
})

test('anonymous session discovery returns the trusted auth mode for choosing the login flow', async(t)=>{
  const {db}=await setup(t,'enrollment')
  const response=await handleRequest(new Request('https://delivery.test/api/auth/session'),{DB:db})
  assert.deepEqual(await response.json(),{authenticated:false,authMode:'enrollment'})
})

test('login revoked while recording success does not return a usable authenticated cookie', async(t)=>{
  const {db}=await setup(t)
  const intercept={...db,prepare(sql){
    const statement=db.prepare(sql)
    if(!sql.includes('INSERT INTO audit_events')) return statement
    return {bind(...values){const bound=statement.bind(...values);return {...bound,async run(){
      const result=await bound.run()
      if(values.includes('login.success')) await revokeUserSessions(db,businessId,'user')
      return result
    }}}}
  }}
  const response=await handleRequest(req('','/api/auth/login','POST',{identifier:'person',password}),{DB:intercept})
  assert.equal(response.status,401);assert.equal(response.headers.get('set-cookie'),null)
})

test('prepared rotation composes credential update revocation session and audit in one rollback-safe batch', async(t)=>{
  const {db,sqlite}=await setup(t)
  const {prepareUserSession}=await import('./sessions.js')
  assert.equal(typeof prepareUserSession,'function')
  const {prepareSecurityEvent}=await import('./audit.js')
  const original=await createUserSession({DB:db},{businessId,userId:'user',now})
  const verifier=await hashHumanPassword('another quiet river')
  const replacement=await prepareUserSession(db,{businessId,userId:'user',now,credentialVerifier:verifier})
  assert.equal(sqlite.prepare('SELECT count(*) n FROM sessions').get().n,1)
  const statements=[
    db.prepare('UPDATE user_credentials SET password_verifier=? WHERE business_id=? AND user_id=?').bind(verifier,businessId,'user'),
    prepareUserSessionRevocation(db,businessId,'user',now),replacement.statement,
    prepareSecurityEvent(db,{businessId,action:'password.changed',result:'success',context:{userId:'user',displayName:'Person',sessionId:replacement.sessionId},now}),
  ]
  await assert.rejects(db.batch([...statements,db.prepare('INSERT INTO missing VALUES (1)')]))
  assert.ok(await authenticateHumanRequest(req(original.token),{DB:db},now))
  assert.equal(sqlite.prepare('SELECT count(*) n FROM audit_events').get().n,0)
  await db.batch(statements)
  assert.equal(await authenticateHumanRequest(req(original.token),{DB:db},now),null)
  assert.ok(await authenticateHumanRequest(req(replacement.token),{DB:db},now))
  assert.equal(sqlite.prepare('SELECT count(*) n FROM audit_events').get().n,1)
})

test('password reset between verification and session insertion rejects the just-verified old password', async(t)=>{
  const {db,sqlite}=await setup(t)
  const replacement=await hashHumanPassword('another quiet river')
  const intercept={...db,prepare(sql){
    const statement=db.prepare(sql)
    if(!sql.includes('INSERT INTO sessions')) return statement
    return {bind(...values){const bound=statement.bind(...values);return {...bound,async run(){
      sqlite.prepare('UPDATE user_credentials SET password_verifier=?').run(replacement)
      return bound.run()
    }}}}
  }}
  const response=await handleRequest(req('','/api/auth/login','POST',{identifier:'person',password}),{DB:intercept})
  assert.equal(response.status,401)
  assert.equal(response.headers.get('set-cookie'),null)
  assert.equal(sqlite.prepare('SELECT count(*) n FROM sessions').get().n,0)
  assert.equal(sqlite.prepare("SELECT count(*) n FROM audit_events WHERE action='login.failure'").get().n,1)
})
