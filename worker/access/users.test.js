import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from '../test-support/settingsDb.js'
import { seedBuiltinRoles } from './roles.js'
import { hashHumanPassword, verifyHumanPassword } from './credentials.js'
import { createUserSession, authenticateHumanRequest } from './sessions.js'
import { consumeAccessInvite } from './invitations.js'
import { listUsers, createUser, updateUser, requestCredentialReset, changeOwnPassword } from './users.js'

const businessId = 'amor-e-sabor'
const password = 'a quiet river flows'
const now = new Date()
async function setup(t, second = true) {
  const fixture = createSettingsDb(); t.after(fixture.close)
  const { db, sqlite } = fixture
  await seedBuiltinRoles(db, businessId, now)
  sqlite.exec("UPDATE business_auth_state SET mode='user_only'")
  const verifier = await hashHumanPassword(password)
  for (const id of second ? ['a','b'] : ['a']) {
    sqlite.prepare(`INSERT INTO users (id,business_id,display_name,login_normalized,role_id,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?)`).run(id,businessId,id,id,`${businessId}:manager`,now.toISOString(),now.toISOString())
    sqlite.prepare(`INSERT INTO user_credentials (business_id,user_id,password_verifier,password_changed_at,created_at,updated_at)
      VALUES (?,?,?,?,?,?)`).run(businessId,id,verifier,now.toISOString(),now.toISOString(),now.toISOString())
  }
  const session = await createUserSession({ DB:db },{businessId,userId:'a',now})
  const context = await authenticateHumanRequest(new Request('https://delivery.test',{headers:{cookie:`amor_session=${session.token}`}}),{DB:db},now)
  return {...fixture,context,session}
}

test('manager creates a normalized invited account and list exposes roles and safe account state',async(t)=>{
  const {db,sqlite,context}=await setup(t)
  const result=await createUser(db,context,{displayName:' Joana ',identifier:' JOANA ',roleId:`${businessId}:operator`,businessId:'evil',actorId:'evil'},now)
  assert.equal(result.user.identifier,'joana');assert.equal(result.user.displayName,'Joana')
  assert.equal(result.user.credentialState,'invited');assert.match(result.invite.token,/^[A-Za-z0-9_-]{43}$/)
  const listing=await listUsers(db,context,now)
  assert.equal(listing.roles.length,2);assert.ok(listing.roles.find(r=>r.code==='manager').capabilities.includes('access.users.manage'))
  assert.equal(JSON.stringify(listing).includes(result.invite.token),false)
  assert.equal(JSON.stringify(listing).includes('password_verifier'),false)
  await assert.rejects(createUser(db,context,{displayName:'Duplicate',identifier:' joana ',roleId:`${businessId}:operator`},now),{status:409,code:'IDENTIFIER_CONFLICT'})
  await consumeAccessInvite(db,{token:result.invite.token,password,businessId,now})
  assert.equal((await listUsers(db,context,now)).users.find(u=>u.id===result.user.id).credentialState,'active')
  assert.equal(sqlite.prepare('SELECT count(*) n FROM audit_events').get().n,1)
})

test('operators cannot administer users and tenant-scoped targets and roles return 404',async(t)=>{
  const {db,sqlite,context}=await setup(t)
  const operator={...context,granted:new Set(['orders.view'])}
  for(const action of [()=>listUsers(db,operator),()=>createUser(db,operator,{}),()=>updateUser(db,operator,'b',{active:false}),()=>requestCredentialReset(db,operator,'b')]) {
    await assert.rejects(action(),{status:403})
  }
  sqlite.exec("INSERT INTO businesses (id,slug,name,created_at,updated_at) SELECT 'other','other', name, created_at, updated_at FROM businesses LIMIT 1")
  await seedBuiltinRoles(db,'other',now)
  sqlite.prepare(`INSERT INTO users(id,business_id,display_name,login_normalized,role_id,created_at,updated_at)
    VALUES('foreign','other','Foreign','foreign','other:manager',?,?)`).run(now.toISOString(),now.toISOString())
  await assert.rejects(createUser(db,context,{displayName:'Other',identifier:'other',roleId:'other:manager'}),{status:404})
  await assert.rejects(updateUser(db,context,'b',{roleId:'other:manager'}),{status:404})
  await assert.rejects(updateUser(db,context,'foreign',{active:false}),{status:404})
  await assert.rejects(requestCredentialReset(db,context,'foreign'),{status:404})
})

test('role change disable and reset revoke all target sessions while own reset requires own password flow',async(t)=>{
  const {db,sqlite,context}=await setup(t)
  const login=()=>createUserSession({DB:db},{businessId,userId:'b',now})
  await login();await login()
  await updateUser(db,context,'b',{roleId:`${businessId}:operator`},now)
  assert.equal(sqlite.prepare("SELECT count(*) n FROM sessions WHERE user_id='b' AND revoked_at IS NULL").get().n,0)
  await login();await updateUser(db,context,'b',{active:false},now)
  assert.equal(sqlite.prepare("SELECT active FROM users WHERE id='b'").get().active,0)
  await updateUser(db,context,'b',{active:true},now);await login()
  const reset=await requestCredentialReset(db,context,'b',now)
  assert.equal(sqlite.prepare("SELECT active FROM user_credentials WHERE user_id='b'").get().active,0)
  assert.equal(sqlite.prepare("SELECT count(*) n FROM sessions WHERE user_id='b' AND revoked_at IS NULL").get().n,0)
  assert.match(reset.invite.token,/^[A-Za-z0-9_-]{43}$/)
  await assert.rejects(requestCredentialReset(db,context,'a',now),{status:403,code:'OWN_RESET_FORBIDDEN'})
})

test('an invited reset-pending inactive-role or grantless manager cannot replace the last usable manager',async(t)=>{
  const {db,sqlite,context}=await setup(t,false)
  await createUser(db,context,{displayName:'Pending',identifier:'pending',roleId:`${businessId}:manager`},now)
  for(const patch of [{active:false},{roleId:`${businessId}:operator`}]) await assert.rejects(updateUser(db,context,'a',patch,now),{status:409,code:'LAST_MANAGER'})
  sqlite.exec("INSERT INTO user_credentials SELECT business_id,id,'pending',1,0,created_at,created_at,updated_at FROM users WHERE id!='a'")
  await assert.rejects(updateUser(db,context,'a',{active:false},now),{code:'LAST_MANAGER'})
  const pendingId=sqlite.prepare("SELECT id FROM users WHERE id!='a'").get().id
  const managerRole=`${businessId}:other-manager`
  sqlite.prepare(`INSERT INTO roles(id,business_id,code,name,active,created_at,updated_at) VALUES(?,?,'other-manager','Other manager',0,?,?)`).run(managerRole,businessId,now.toISOString(),now.toISOString())
  sqlite.prepare("INSERT INTO role_capabilities VALUES (?,?,'access.users.manage')").run(businessId,managerRole)
  sqlite.prepare('UPDATE users SET role_id=? WHERE id=?').run(managerRole,pendingId)
  sqlite.prepare('UPDATE user_credentials SET active=1 WHERE user_id=?').run(pendingId)
  await assert.rejects(updateUser(db,context,'a',{active:false},now),{code:'LAST_MANAGER'})
  sqlite.prepare('UPDATE roles SET active=1 WHERE id=?').run(managerRole)
  sqlite.prepare('DELETE FROM role_capabilities WHERE role_id=?').run(managerRole)
  await assert.rejects(updateUser(db,context,'a',{active:false},now),{code:'LAST_MANAGER'})
  // A different actor may initiate recovery only while another usable manager exists.
  const other={...context,userId:sqlite.prepare("SELECT id FROM users WHERE id!='a'").get().id}
  await assert.rejects(requestCredentialReset(db,other,'a',now),{code:'LAST_MANAGER'})
  assert.equal(sqlite.prepare('SELECT count(*) n FROM access_invites').get().n,1)
})

test('concurrent managers removing each other serialize so one usable manager remains',async(t)=>{
  const {db,sqlite,context}=await setup(t)
  const results=await Promise.allSettled([updateUser(db,context,'b',{active:false},now),updateUser(db,{...context,userId:'b'},'a',{roleId:`${businessId}:operator`},now)])
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'LAST_MANAGER')
  assert.equal(sqlite.prepare(`SELECT count(*) n FROM users u JOIN user_credentials c ON c.user_id=u.id AND c.business_id=u.business_id AND c.active=1
    JOIN roles r ON r.id=u.role_id AND r.business_id=u.business_id AND r.active=1 JOIN role_capabilities rc ON rc.role_id=r.id AND rc.business_id=r.business_id
    WHERE u.active=1 AND rc.capability='access.users.manage'`).get().n,1)
})

test('storage failure rolls account invite revocation and audit changes back together',async(t)=>{
  const {db,sqlite,context}=await setup(t)
  const original=await createUserSession({DB:db},{businessId,userId:'b',now})
  sqlite.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'injected failure'); END")
  await assert.rejects(createUser(db,context,{displayName:'New',identifier:'new',roleId:`${businessId}:operator`},now),/injected failure/)
  await assert.rejects(requestCredentialReset(db,context,'b',now),/injected failure/)
  await assert.rejects(updateUser(db,context,'b',{active:false},now),/injected failure/)
  await assert.rejects(changeOwnPassword(db,context,{currentPassword:password,password:'another quiet river'},now),/injected failure/)
  assert.equal(sqlite.prepare('SELECT count(*) n FROM users').get().n,2)
  assert.equal(sqlite.prepare('SELECT count(*) n FROM access_invites').get().n,0)
  assert.ok(await verifyHumanPassword(password,sqlite.prepare("SELECT password_verifier FROM user_credentials WHERE user_id='a'").get().password_verifier))
  assert.ok(await authenticateHumanRequest(new Request('https://delivery.test',{headers:{cookie:`amor_session=${original.token}`}}),{DB:db},now))
})

test('password change validates current secret rotates token and rolls back when the verifier changed concurrently',async(t)=>{
  const {db,sqlite,context,session}=await setup(t)
  await assert.rejects(changeOwnPassword(db,context,{currentPassword:'wrong',password:'another quiet river'},now),{status:400,code:'CURRENT_PASSWORD_INVALID'})
  const replacement=await hashHumanPassword('concurrent quiet river')
  const intercept={...db,async batch(statements){sqlite.prepare("UPDATE user_credentials SET password_verifier=? WHERE user_id='a'").run(replacement);return db.batch(statements)}}
  await assert.rejects(changeOwnPassword(intercept,context,{currentPassword:password,password:'another quiet river'},now),{status:409,code:'CREDENTIAL_CHANGED'})
  assert.equal(sqlite.prepare("SELECT count(*) n FROM sessions WHERE user_id='a' AND revoked_at IS NULL").get().n,1)
  assert.equal(sqlite.prepare('SELECT count(*) n FROM audit_events').get().n,0)
  assert.equal(sqlite.prepare("SELECT password_verifier FROM user_credentials WHERE user_id='a'").get().password_verifier,replacement)
  const changed=await changeOwnPassword(db,context,{currentPassword:'concurrent quiet river',password:'another quiet river'},now)
  assert.notEqual(changed.token,session.token)
  assert.ok(await verifyHumanPassword('another quiet river',sqlite.prepare("SELECT password_verifier FROM user_credentials WHERE user_id='a'").get().password_verifier))
})

test('name-only update preserves a role changed after the target read',async(t)=>{
  const {db,sqlite,context}=await setup(t)
  const intercept={...db,async batch(statements){sqlite.prepare("UPDATE users SET role_id=? WHERE id='b'").run(`${businessId}:operator`);return db.batch(statements)}}
  const result=await updateUser(intercept,context,'b',{displayName:'Renamed'},now)
  assert.equal(result.user.displayName,'Renamed');assert.equal(result.user.roleId,`${businessId}:operator`)
})

test('the last-manager check follows persisted capabilities rather than the role label',async(t)=>{
  const {db,sqlite,context}=await setup(t)
  sqlite.prepare('UPDATE users SET role_id=? WHERE id=?').run(`${businessId}:operator`,'a')
  sqlite.prepare("INSERT INTO role_capabilities VALUES (?,?,'access.users.manage')").run(businessId,`${businessId}:operator`)
  sqlite.prepare("DELETE FROM role_capabilities WHERE role_id=? AND capability='access.users.manage'").run(`${businessId}:manager`)
  await assert.rejects(updateUser(db,context,'a',{active:false},now),{code:'LAST_MANAGER'})
  await updateUser(db,context,'b',{active:false},now)
  assert.equal(sqlite.prepare("SELECT active FROM users WHERE id='a'").get().active,1)
})
