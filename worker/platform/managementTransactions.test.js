import test from 'node:test'
import assert from 'node:assert/strict'
import { createManagementFixture } from '../test-support/companyManagementDb.js'
import { validateManagementInput, prepareManagementTransaction, prepareManagementCompletion } from './managementTransactions.js'
import { commitIdentityStatements } from '../identity/transactions.js'

test('management input bounds reason, revision, UUID and unexpected fields', () => {
  const target={businessId:'A',operation:'suspend'},key=crypto.randomUUID()
  for (const input of [{reason:'xx',expectedRevision:0},{reason:'a'.repeat(501),expectedRevision:0},{reason:'válido',expectedRevision:-1},{reason:'válido',expectedRevision:1.5},{reason:'válido',expectedRevision:0,roleId:'manager'}]) assert.throws(()=>validateManagementInput(target,input,key),{status:400})
  assert.throws(()=>validateManagementInput(target,{reason:'válido',expectedRevision:0},'invalid'),{status:400})
  assert.equal(validateManagementInput(target,{reason:'  😀😀😀  ',expectedRevision:0},key).reason,'😀😀😀')
})

test('same management request replays receipt without advancing revision or audit', async t => {
  const f=await createManagementFixture(t),target={businessId:f.businesses.A,operation:'suspend'},input={reason:'Manutenção',expectedRevision:0},key=crypto.randomUUID()
  const p=await prepareManagementTransaction(f.db,f.contexts.admin,target,input,{idempotencyKey:key,now:f.now})
  const result={businessId:f.businesses.A,operation:'suspend',resourceId:f.businesses.A,managementRevision:1}
  await commitIdentityStatements(f.db,[...p.statements,...prepareManagementCompletion(f.db,p,result,{action:'business.suspended',resourceType:'business',resourceId:f.businesses.A},f.now)])
  const replay=await prepareManagementTransaction(f.db,f.contexts.admin,target,input,{idempotencyKey:key,now:f.now})
  assert.deepEqual(replay.replay,result)
  assert.equal(f.sqlite.prepare('SELECT management_revision FROM businesses WHERE id=?').get(f.businesses.A).management_revision,1)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM platform_audit_events').get().n,1)
  await assert.rejects(prepareManagementTransaction(f.db,f.contexts.admin,target,{...input,reason:'Outro motivo'},{idempotencyKey:key,now:f.now}),{status:409})
  f.sqlite.prepare("DELETE FROM platform_grants WHERE account_id=? AND capability='platform.businesses.manage'").run(f.accounts.admin)
  await assert.rejects(prepareManagementTransaction(f.db,f.contexts.admin,target,input,{idempotencyKey:key,now:f.now}),{status:403})
})

test('management grant revoked during commit rolls back receipt, revision and audit', async t => {
  const f=await createManagementFixture(t),target={businessId:f.businesses.A,operation:'suspend'},input={reason:'Manutenção',expectedRevision:0}
  const p=await prepareManagementTransaction(f.db,f.contexts.admin,target,input,{idempotencyKey:crypto.randomUUID(),now:f.now})
  f.sqlite.prepare("DELETE FROM platform_grants WHERE account_id=? AND capability='platform.businesses.manage'").run(f.accounts.admin)
  await assert.rejects(commitIdentityStatements(f.db,[...p.statements,...prepareManagementCompletion(f.db,p,{businessId:f.businesses.A,operation:'suspend',resourceId:f.businesses.A,managementRevision:1},{action:'business.suspended',resourceType:'business',resourceId:f.businesses.A},f.now)]))
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM platform_management_receipts').get().n,0)
  assert.equal(f.sqlite.prepare('SELECT management_revision FROM businesses WHERE id=?').get(f.businesses.A).management_revision,0)
})
