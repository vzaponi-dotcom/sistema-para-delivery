import test from 'node:test'
import assert from 'node:assert/strict'
import { createManagementAttempts } from './managementAttempts.js'

test('lost management response keeps immutable intent and reconciles by reading receipt',async()=>{
  const attempts=createManagementAttempts(),keys=[],input={reason:'Manutenção',expectedRevision:0},target={businessId:'A',operation:'suspend'}
  const api={manageBusiness:async(_target,_input,key)=>{keys.push(key);throw new Error('offline')},getManagementAttempt:async(id,key)=>{assert.equal(id,'A');assert.equal(key,keys[0]);return {status:'confirmed',result:{businessId:'A',managementRevision:1}}}}
  await attempts.execute({accountId:'author',contextId:'platform-A',input,target,api})
  input.reason='Mutated'
  assert.equal(attempts.getSnapshot('author').input.reason,'Manutenção')
  assert.equal(attempts.isBlocking('author'),true)
  assert.equal(attempts.getSnapshot('other'),null)
  await attempts.reconcile({accountId:'author',api})
  assert.equal(attempts.isBlocking('author'),false)
  assert.equal(keys.length,1)
})

test('missing receipt does not automatically repeat or release uncertain action',async()=>{
  const attempts=createManagementAttempts(),calls=[]
  const api={manageBusiness:async(_target,_input,key)=>{calls.push(key);throw new Error('offline')},getManagementAttempt:async()=>{throw Object.assign(new Error('not found'),{status:404})}}
  await attempts.execute({accountId:'author',contextId:'platform-A',input:{reason:'Manutenção',expectedRevision:0},target:{businessId:'A',operation:'suspend'},api})
  await attempts.reconcile({accountId:'author',api})
  assert.equal(attempts.isBlocking('author'),true)
  assert.equal(calls.length,1)
  await attempts.retryConfirmedAttempt({accountId:'other',api})
  assert.equal(calls.length,1)
  await attempts.retryConfirmedAttempt({accountId:'author',api})
  assert.deepEqual(calls,[calls[0],calls[0]])
})
