import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from '../test-support/settingsDb.js'
import * as audit from './audit.js'

test('permitted attribution remains bounded private and truthful for renamed legacy system and unknown actors',async t=>{
  const {db,sqlite,close}=createSettingsDb();t.after(close)
  let module
  try { module=await import('./attribution.js') } catch {}
  assert.equal(typeof module?.loadOrderAttributions,'function')
  for(let i=0;i<120;i++)await db.batch([audit.prepareAuditEvent(db,{businessId:'amor-e-sabor',legacy:true},{action:'order.created',resourceType:'order',resourceId:`order-${i}`})])
  const prepare=db.prepare;let reads=0
  db.prepare=sql=>{const stmt=prepare(sql);return {...stmt,bind:(...values)=>{assert.ok(values.length<=100);reads++;return stmt.bind(...values)}}}
  const actors=await module.loadOrderAttributions(db,'amor-e-sabor',Array.from({length:121},(_,i)=>`order-${i}`))
  assert.equal(reads,2)
  assert.deepEqual(actors.get('order-0').createdBy,{type:'legacy',userId:null,displayName:'Acesso legado'})
  assert.deepEqual(actors.get('order-120').createdBy,{type:'unknown',userId:null,displayName:'Autor não identificado'})
  assert.equal(JSON.stringify([...actors]).includes('sessionId'),false)
  assert.equal((await module.loadOrderAttributions(db,'other',['order-0'])).get('order-0').createdBy.type,'unknown')
})

test('printing attribution uses accepted event order when observations share a clock millisecond',async t=>{
  const {db,sqlite,close}=createSettingsDb();t.after(close)
  const {loadPrintAttributions}=await import('./attribution.js')
  sqlite.exec(`INSERT INTO audit_events(id,business_id,occurred_at,actor_type,actor_name,action,resource_type,resource_id,result)
    VALUES('z','amor-e-sabor','2026-09-30T12:00:00.000Z','legacy','Acesso legado','printing.requested','print-job','job','success');
    INSERT INTO audit_events(id,business_id,occurred_at,actor_type,actor_name,action,resource_type,resource_id,result)
    VALUES('a','amor-e-sabor','2026-09-30T12:00:00.000Z','system','Sistema','printing.outcome.observed','print-job','job','unknown');`)
  assert.deepEqual((await loadPrintAttributions(db,'amor-e-sabor',['job'])).get('job'),{
    requestedBy:{type:'legacy',userId:null,displayName:'Acesso legado'},lastActionBy:{type:'system',userId:null,displayName:'Sistema'},
  })
})
