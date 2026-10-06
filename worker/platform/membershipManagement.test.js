import test from 'node:test'
import assert from 'node:assert/strict'
import { createManagementFixture } from '../test-support/companyManagementDb.js'
import { performBusinessManagement } from './managementCommands.js'

const change=(f,operation,userId,revision)=>performBusinessManagement({DB:f.db},f.contexts.admin,{businessId:f.businesses.A,operation,userId},{reason:'Alteração de acesso',expectedRevision:revision},{idempotencyKey:crypto.randomUUID(),now:f.now})
test('last manager is protected while enabled but can be revoked and recovered while suspended',async t=>{
  const f=await createManagementFixture(t),credentials=f.sqlite.prepare('SELECT * FROM account_credentials WHERE account_id=?').get(f.accounts.alice)
  await assert.rejects(change(f,'membership.revoke',f.members.aliceA,0),{code:'LAST_MANAGER'})
  f.sqlite.prepare("UPDATE businesses SET lifecycle_status='suspended' WHERE id=?").run(f.businesses.A)
  await change(f,'membership.revoke',f.members.aliceA,0)
  assert.equal(f.sqlite.prepare('SELECT membership_state FROM users WHERE id=?').get(f.members.aliceA).membership_state,'inactive')
  assert.equal(f.sqlite.prepare('SELECT revoked_at FROM identity_sessions WHERE id=?').get(f.contexts.aliceB.identitySessionId).revoked_at,null)
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM account_credentials WHERE account_id=?').get(f.accounts.alice),credentials)
  await change(f,'membership.reactivate',f.members.aliceA,1)
  assert.equal(f.sqlite.prepare('SELECT membership_state FROM users WHERE id=?').get(f.members.aliceA).membership_state,'active')
  assert.equal(f.sqlite.prepare('SELECT lifecycle_status FROM businesses WHERE id=?').get(f.businesses.A).lifecycle_status,'suspended')
})
test('membership from another company is not administrable through the target company',async t=>{
  const f=await createManagementFixture(t)
  await assert.rejects(change(f,'membership.revoke',f.members.carolB,0),{status:404})
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM platform_management_receipts').get().n,0)
})
