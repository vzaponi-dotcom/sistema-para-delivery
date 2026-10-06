import test from 'node:test'
import assert from 'node:assert/strict'
import { createManagementFixture } from '../test-support/companyManagementDb.js'
import { listPlatformMemberships, listPlatformHistory, getPlatformManagementAttempt } from './managementRepository.js'
import { listPlatformBusinesses } from './businessesRepository.js'
import { performBusinessManagement } from './managementCommands.js'
import { handlePlatformBusinessesApi } from './businessesApi.js'
import { prepareAccountSession } from '../identity/sessions.js'
import { commitIdentityStatements } from '../identity/transactions.js'
import { handleRequest } from '../index.js'

test('directory searches linked email without duplicates and binds cursor to lifecycle filter',async t=>{
  const f=await createManagementFixture(t)
  assert.equal((await listPlatformBusinesses(f.db,{query:'alice@example.test'})).items.length,2)
  f.sqlite.prepare("UPDATE businesses SET lifecycle_status='deleted' WHERE id=?").run(f.businesses.A)
  assert.equal((await listPlatformBusinesses(f.db)).items.some(x=>x.id===f.businesses.A),false)
  assert.deepEqual((await listPlatformBusinesses(f.db,{status:'deleted'})).items.map(x=>x.id),[f.businesses.A])
  const page=await listPlatformBusinesses(f.db,{status:'all',limit:1})
  await assert.rejects(listPlatformBusinesses(f.db,{status:'visible',cursor:page.nextCursor}),{status:400})
})
test('members and historical audit expose safe facts and denied last-manager eligibility',async t=>{
  const f=await createManagementFixture(t)
  const members=await listPlatformMemberships(f.db,f.businesses.A,f.now)
  assert.equal(members.users.find(u=>u.id===f.members.aliceA).canRevoke,false)
  assert.equal(members.users.find(u=>u.id===f.members.bobA).canRevoke,true)
  f.sqlite.prepare('INSERT INTO platform_audit_events(id,account_id,business_id,action,result,created_at) VALUES(?,?,?,?,?,?)').run('old',f.accounts.admin,f.businesses.A,'business.created','success','2026-10-02 00:00:00')
  const history=await listPlatformHistory(f.db,f.businesses.A,{limit:1})
  assert.equal(history.items[0].reason,null)
  assert.equal(history.items[0].actorName,'Admin')
  for (const value of ['password_verifier','token_hash','role_capabilities']) assert.equal(JSON.stringify(members).includes(value),false)
})
test('receipt reconciliation is scoped to author/company and API protects management routes',async t=>{
  const f=await createManagementFixture(t),key=crypto.randomUUID()
  await performBusinessManagement({DB:f.db},f.contexts.admin,{businessId:f.businesses.A,operation:'suspend'},{reason:'Manutenção',expectedRevision:0},{idempotencyKey:key,now:f.now})
  assert.equal((await getPlatformManagementAttempt(f.db,f.accounts.admin,f.businesses.A,key)).status,'confirmed')
  await assert.rejects(getPlatformManagementAttempt(f.db,f.accounts.alice,f.businesses.A,key),{status:404})
  const req=(path,method='GET',body)=>new Request(`https://example.test/api/platform/businesses/${f.businesses.A}/${path}`,{method,headers:{origin:'https://example.test','X-Mesiva-Context':f.contexts.admin.contextId,'content-type':'application/json','Idempotency-Key':crypto.randomUUID()},...(body?{body:JSON.stringify(body)}:{})})
  assert.equal((await handlePlatformBusinessesApi(req(`management-attempts/${key}`),{DB:f.db},f.contexts.admin,{now:f.now})).status,200)
  f.sqlite.prepare("DELETE FROM platform_grants WHERE account_id=? AND capability='platform.businesses.manage'").run(f.accounts.admin)
  assert.equal((await handlePlatformBusinessesApi(req('resume','POST',{reason:'Retorno',expectedRevision:1}),{DB:f.db},f.contexts.admin,{now:f.now})).status,403)
})

test('complete Worker routes administrative mutations through platform authentication',async t=>{
  const f=await createManagementFixture(t)
  const session=await prepareAccountSession(f.db,{accountId:f.accounts.admin,expectedCredentialRevision:1,scope:'platform'})
  await commitIdentityStatements(f.db,session.statements)
  const result=await handleRequest(new Request(`https://example.test/api/platform/businesses/${f.businesses.A}/suspend`,{method:'POST',headers:{origin:'https://example.test',cookie:`mesiva_session=${session.value.token}`,'X-Mesiva-Context':session.value.contextId,'content-type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({reason:'Manutenção',expectedRevision:0})}),{DB:f.db,AUTH_MULTI_COMPANY_ENABLED:true})
  assert.equal(result.status,200)
  assert.equal(f.sqlite.prepare('SELECT lifecycle_status FROM businesses WHERE id=?').get(f.businesses.A).lifecycle_status,'suspended')
})

test('history pagination orders mixed SQLite and ISO dates chronologically with id tie-break',async t=>{
  const f=await createManagementFixture(t)
  const insert=f.sqlite.prepare('INSERT INTO platform_audit_events(id,account_id,business_id,action,result,created_at) VALUES(?,?,?,?,?,?)')
  for (const [id,date] of [['new','2026-10-02 18:00:00'],['same-z','2026-10-02T12:00:00.000Z'],['same-a','2026-10-02 12:00:00'],['old','2026-10-01T22:00:00.000Z']]) insert.run(id,f.accounts.admin,f.businesses.A,'business.created','success',date)
  let cursor=null
  const ids=[]
  do {
    const page=await listPlatformHistory(f.db,f.businesses.A,{limit:1,cursor})
    ids.push(...page.items.map(item=>item.id));cursor=page.nextCursor
  } while(cursor)
  assert.deepEqual(ids,['new','same-z','same-a','old'])
})
