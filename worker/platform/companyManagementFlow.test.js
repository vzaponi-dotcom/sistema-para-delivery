import test from 'node:test'
import assert from 'node:assert/strict'
import { createManagementFixture } from '../test-support/companyManagementDb.js'
import { seedTenantResources } from '../test-support/tenantResources.js'
import { performBusinessManagement } from './managementCommands.js'
import { listEligibleBusinesses } from '../tenancy/eligibleBusinesses.js'
import { updateMembership } from '../tenancy/memberships.js'
import { createBusiness } from './businessProvisioning.js'
import { resendCompanyInvitation, acceptCompanyInvitation } from '../tenancy/companyInvitations.js'

const env=f=>({DB:f.db,AUTH_MULTI_COMPANY_ENABLED:true,RESEND_API_KEY:'synthetic',AUTH_EMAIL_FROM:'Mesiva <access@example.test>',AUTH_PUBLIC_ORIGIN:'https://example.test'})
const manage=(f,target,revision,extra={},options={})=>performBusinessManagement(env(f),f.contexts.admin,target,{reason:'Verificação integrada',expectedRevision:revision,...extra},{idempotencyKey:crypto.randomUUID(),now:f.now,...options})

test('full administrative recovery preserves operational data, credentials and other-company access',async t=>{
  const f=await createManagementFixture(t)
  seedTenantResources(f.sqlite,f.businesses.A,'A')
  const tables=['orders','order_items','clients','products','payments','payment_receipts','payment_allocations','movements','table_tabs','table_reservations','print_jobs','print_job_attempts']
  const before=tables.map(table=>f.sqlite.prepare(`SELECT * FROM ${table} WHERE business_id=? ORDER BY id`).all(f.businesses.A)),credentials=f.sqlite.prepare('SELECT * FROM account_credentials ORDER BY account_id').all()
  const target={businessId:f.businesses.A}
  await manage(f,{...target,operation:'suspend'},0)
  await manage(f,{...target,operation:'membership.revoke',userId:f.members.aliceA},1)
  await manage(f,{...target,operation:'delete'},2,{confirmationName:'Company A'})
  await manage(f,{...target,operation:'restore'},3)
  assert.equal(f.sqlite.prepare('SELECT lifecycle_status FROM businesses WHERE id=?').get(f.businesses.A).lifecycle_status,'suspended')
  await manage(f,{...target,operation:'membership.reactivate',userId:f.members.aliceA},4)
  await manage(f,{...target,operation:'resume'},5)
  assert.deepEqual(tables.map(table=>f.sqlite.prepare(`SELECT * FROM ${table} WHERE business_id=? ORDER BY id`).all(f.businesses.A)),before)
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM account_credentials ORDER BY account_id').all(),credentials)
  assert.ok((await listEligibleBusinesses(f.db,f.accounts.alice)).some(b=>b.businessId===f.businesses.B))
  assert.ok(f.sqlite.prepare('SELECT revoked_at FROM identity_sessions WHERE id=?').get(f.contexts.aliceA.identitySessionId).revoked_at)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM platform_management_receipts').get().n,6)
})

test('resume rejects an administrator whose credential is unsupported',async t=>{
  const f=await createManagementFixture(t)
  f.sqlite.prepare("UPDATE businesses SET lifecycle_status='suspended' WHERE id=?").run(f.businesses.A)
  f.sqlite.prepare("UPDATE account_credentials SET password_verifier='unsupported' WHERE account_id=?").run(f.accounts.alice)
  await assert.rejects(manage(f,{businessId:f.businesses.A,operation:'resume'},0),{code:'LAST_MANAGER'})
})

test('operational team edit makes an old platform confirmation stale',async t=>{
  const f=await createManagementFixture(t)
  await updateMembership(f.db,f.contexts.aliceA,f.members.bobA,{displayName:'Novo nome'},f.now)
  await assert.rejects(manage(f,{businessId:f.businesses.A,operation:'suspend'},0),{code:'BUSINESS_MANAGEMENT_CHANGED'})
})

test('legacy initial invitation resend advances administrative revision',async t=>{
  const f=await createManagementFixture(t),work=[]
  const created=await createBusiness(env(f),f.contexts.admin,{name:'Pendente',managerName:'Pessoa fictícia',managerEmail:'pending@example.test'},{idempotencyKey:crypto.randomUUID(),now:f.now,waitUntil:promise=>work.push(promise),deliver:async()=>({status:'accepted'})})
  await Promise.all(work)
  await resendCompanyInvitation(env(f),f.contexts.admin,created.invitationId,{now:new Date(f.now.getTime()+61000),deliver:async()=>({status:'accepted'})})
  assert.equal(f.sqlite.prepare('SELECT management_revision FROM businesses WHERE id=?').get(created.businessId).management_revision,1)
})

test('pending company restoration requires explicit invitation reissue before activation',async t=>{
  const f=await createManagementFixture(t),work=[],messages=[]
  const created=await createBusiness(env(f),f.contexts.admin,{name:'Cadastro recuperável',managerName:'Pessoa fictícia',managerEmail:'pending@example.test'},{idempotencyKey:crypto.randomUUID(),now:f.now,waitUntil:promise=>work.push(promise),deliver:async()=>({status:'accepted'})})
  await Promise.all(work)
  const target={businessId:created.businessId}
  await manage(f,{...target,operation:'suspend'},0)
  await manage(f,{...target,operation:'delete'},1,{confirmationName:'Cadastro recuperável'})
  await manage(f,{...target,operation:'restore'},2)
  await manage(f,{...target,operation:'resume'},3)
  assert.equal(f.sqlite.prepare('SELECT access_status FROM businesses WHERE id=?').get(created.businessId).access_status,'pending')
  const at=new Date(f.now.getTime()+61000)
  await manage(f,{...target,operation:'invitation.resend',invitationId:created.invitationId},4,{}, {now:at,deliver:async(_env,message)=>{messages.push(message);return {status:'accepted'}}})
  await acceptCompanyInvitation(f.db,{token:messages[0].token,password:'Fictitious test password 2026!',now:at})
  assert.equal(f.sqlite.prepare('SELECT access_status FROM businesses WHERE id=?').get(created.businessId).access_status,'active')
})
