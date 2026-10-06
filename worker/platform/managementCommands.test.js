import test from 'node:test'
import assert from 'node:assert/strict'
import { createManagementFixture } from '../test-support/companyManagementDb.js'
import { performBusinessManagement } from './managementCommands.js'

test('two management calls with the same revision admit only one committed action',async t=>{
  const f=await createManagementFixture(t),input={reason:'Manutenção',expectedRevision:0},target={businessId:f.businesses.A,operation:'suspend'}
  const results=await Promise.allSettled([1,2].map(()=>performBusinessManagement({DB:f.db},f.contexts.admin,target,input,{idempotencyKey:crypto.randomUUID(),now:f.now})))
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(results.find(r=>r.status==='rejected').reason.status,409)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM platform_management_receipts').get().n,1)
})
