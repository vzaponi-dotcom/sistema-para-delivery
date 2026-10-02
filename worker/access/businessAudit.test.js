import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from '../test-support/settingsDb.js'
import { createClient, createProduct, createOrder, updateOrderStatus } from '../repositories.js'
import { registerOrderPayment } from '../paymentRepository.js'
import { withAuditContext } from './audit.js'
import { seedBuiltinRoles } from './roles.js'
import { createUserSession } from './sessions.js'
import { handleRequest } from '../index.js'
import { loadOrderAttributions, loadPrintAttributions } from './attribution.js'
import { cancelOrder, registerOrderRefund } from '../orderCancellation.js'
import { transferOpenTableTab } from '../tableRepository.js'
import { loadOperations, saveOperations } from '../operationSettingsRepository.js'
import { claimNextRecoveryPrintJob, retryPrintJob, listPrintJobs } from '../orderPrintingRepository.js'
import { discardOperationalPrintJobs } from '../orderPrintingRepository.js'
import { claimNextPrintJob } from '../orderPrintingCentralClaim.js'
import { createPrintJobAttempt, markPrintAttemptSubmitting, markPrintAttemptUnknown, resolveUnknownPrintAttempt } from '../printAttemptRepository.js'

const businessId='amor-e-sabor',now=new Date('2026-09-30T12:00:00.000Z')
async function setup(t) {
  const fixture=createSettingsDb();t.after(fixture.close)
  await seedBuiltinRoles(fixture.db,businessId,now)
  fixture.sqlite.prepare(`INSERT INTO users(id,business_id,display_name,login_normalized,role_id,created_at,updated_at) VALUES('actor',?,'Original','actor',?,'2026-09-30','2026-09-30')`).run(businessId,`${businessId}:manager`)
  return {...fixture,db:withAuditContext(fixture.db,{businessId,userId:'actor',displayName:'Original'})}
}
test('order creation replay payment and finalization retain authoritative resource-linked actor snapshots',async t=>{
  const {db,sqlite}=await setup(t)
  const client=await createClient(db,businessId,{name:'Client',phone:'',address:''},now)
  const product=await createProduct(db,businessId,{name:'Plate',category:'Refeições',priceCents:2500,size:'',presentationType:'unit',presentationValue:'',presentationUnit:''},now)
  const input={customerIdentity:{type:'registered_client',clientId:client.id},type:'Retirada',orderDate:'2026-09-30',items:[{productId:product.id,quantity:1,note:''}],deliveryFeeCents:0,adjustment:{type:'none',mode:'fixed',storedValue:0,reason:''},paymentAllocations:null,idempotencyKey:'same',actorLabel:'forged'}
  const order=await createOrder(db,businessId,input,now)
  assert.equal((await createOrder(db,businessId,input,now)).id,order.id)
  const automatic=sqlite.prepare("SELECT id FROM print_jobs WHERE order_id=? AND trigger='automatic'").get(order.id)
  if(automatic) {
    sqlite.prepare("UPDATE print_jobs SET status='failed' WHERE id=?").run(automatic.id)
    await retryPrintJob(db,businessId,automatic.id,now,'forged')
    assert.equal(sqlite.prepare("SELECT actor_user_id FROM audit_events WHERE action='printing.retried'").get().actor_user_id,'actor')
  }
  await registerOrderPayment(db,businessId,order.id,[{methodCode:'pix',amountCents:2500}],now)
  await updateOrderStatus(db,businessId,order.id,now)
  const events=sqlite.prepare("SELECT * FROM audit_events WHERE resource_type='order' AND resource_id=? ORDER BY action").all(order.id)
  assert.deepEqual(events.map(e=>e.action),['order.created','order.finalized','payment.received'])
  assert.ok(events.every(e=>e.actor_user_id==='actor' && e.actor_name==='Original'))
  sqlite.exec("UPDATE users SET display_name='Renamed',active=0 WHERE id='actor'")
  assert.ok(events.every(e=>!e.metadata_json.includes('forged')))
  const attribution=(await loadOrderAttributions(db,businessId,[order.id])).get(order.id)
  assert.deepEqual(attribution,{createdBy:{type:'user',userId:'actor',displayName:'Original'},finalizedBy:{type:'user',userId:'actor',displayName:'Original'},paidBy:{type:'user',userId:'actor',displayName:'Original'}})
  sqlite.exec("UPDATE business_auth_state SET mode='user_only'; INSERT INTO users(id,business_id,display_name,login_normalized,role_id,created_at,updated_at) VALUES('reader','amor-e-sabor','Reader','reader@example.test','amor-e-sabor:operator','2026-09-30','2026-09-30'); UPDATE users SET email_verified_at='2026-09-30T12:00:00.000Z' WHERE id='reader'; INSERT INTO user_credentials(business_id,user_id,password_verifier,password_changed_at,created_at,updated_at) VALUES('amor-e-sabor','reader','fixture','2026-09-30','2026-09-30','2026-09-30')")
  const session=await createUserSession({DB:db},{businessId,userId:'reader'})
  for(const path of ['/api/orders','/api/bootstrap']) {
    const response=await handleRequest(new Request(`https://delivery.test${path}`,{headers:{cookie:`amor_session=${session.token}`}}),{DB:db})
    assert.equal(response.status,200)
    const data=await response.json()
    assert.deepEqual(data.orders.find(o=>o.id===order.id).attribution,attribution)
    assert.equal(JSON.stringify(data.orders).includes('sessionId'),false)
    assert.equal(Object.hasOwn(data,'activity'),false)
  }
  await cancelOrder(db,businessId,order.id,{reason:'client_changed_mind'},now)
  await registerOrderRefund(db,businessId,order.id,{refundMethod:'Pix'},now)
  assert.deepEqual(sqlite.prepare("SELECT action,actor_user_id,actor_name FROM audit_events WHERE action IN ('order.cancelled','payment.refunded') ORDER BY action").all().map(row=>({...row})),[
    {action:'order.cancelled',actor_user_id:'actor',actor_name:'Original'},{action:'payment.refunded',actor_user_id:'actor',actor_name:'Original'}])
})
test('client mutation fails atomically when audit storage rejects its event',async t=>{
  const {db,sqlite}=await setup(t)
  sqlite.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END")
  await assert.rejects(createClient(db,businessId,{name:'Rollback',phone:'',address:''},now),/audit unavailable/)
  assert.equal(sqlite.prepare("SELECT count(*) n FROM clients WHERE name='Rollback'").get().n,0)
})
test('bulk discard of 120 jobs obeys D1 binding limit and audit failure rolls back jobs and station cleanup',async t=>{
  const {db,sqlite}=await setup(t)
  for(let i=0;i<120;i++) sqlite.prepare(`INSERT INTO print_jobs(id,business_id,type,trigger,status,copies_requested,copies_printed,snapshot_json,created_at,available_at) VALUES(?,?,'test','manual','pending',1,0,'{}',?,?)`).run(`job-${i}`,businessId,now.toISOString(),now.toISOString())
  sqlite.prepare(`INSERT INTO print_stations(id,business_id,name,platform,is_primary,auto_print_enabled,default_copies,recovery_job_id,created_at,updated_at) VALUES('station',?,'Printer','windows',1,1,1,'job-119',?,?)`).run(businessId,now.toISOString(),now.toISOString())
  const prepare=db.prepare
  db.prepare=sql=>{const statement=prepare(sql);return {...statement,bind:(...values)=>{assert.ok(values.length<=100,`D1 limit exceeded: ${values.length}`);return statement.bind(...values)}}}
  sqlite.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END")
  await assert.rejects(discardOperationalPrintJobs(db,businessId,'Original',now),/audit unavailable/)
  assert.equal(sqlite.prepare("SELECT count(*) n FROM print_jobs WHERE status='pending'").get().n,120)
  assert.equal(sqlite.prepare("SELECT recovery_job_id FROM print_stations").get().recovery_job_id,'job-119')
  sqlite.exec('DROP TRIGGER reject_audit')
  const result=await discardOperationalPrintJobs(db,businessId,'Original',now)
  assert.equal(result.discardedCount,120)
  assert.equal(sqlite.prepare("SELECT count(*) n FROM audit_events WHERE action='printing.discarded'").get().n,120)
  assert.equal(sqlite.prepare('SELECT recovery_job_id FROM print_stations').get().recovery_job_id,null)
})

test('validated station execution records system intention and uncertainty; manual resolution is the authenticated human',async t=>{
  const {db,sqlite}=await setup(t)
  const at=now.toISOString()
  sqlite.prepare(`INSERT INTO print_stations(id,business_id,name,platform,is_primary,auto_print_enabled,default_copies,qz_ready,printer_ready,physical_state,last_seen_at,created_at,updated_at) VALUES('station',?,'Printer','windows',1,1,1,1,1,'ready',?,?,?)`).run(businessId,at,at,at)
  sqlite.prepare(`INSERT INTO table_tabs(id,business_id,table_identifier,status,opened_at,created_at,updated_at,tab_number) VALUES('tab',?,'1','open',?,?,?,1)`).run(businessId,at,at,at)
  sqlite.prepare(`INSERT INTO print_jobs(id,business_id,table_tab_id,type,trigger,status,copies_requested,copies_printed,snapshot_json,created_at,available_at) VALUES('job',?,'tab','table-tab','manual','pending',1,0,'{}',?,?)`).run(businessId,at,at)
  await claimNextPrintJob(db,businessId,'station',now)
  const attempt=await createPrintJobAttempt(db,businessId,{jobId:'job',stationId:'station',copyNumber:1},now)
  await markPrintAttemptSubmitting(db,businessId,attempt.id,'station',now)
  await markPrintAttemptSubmitting(db,businessId,attempt.id,'station',now)
  await markPrintAttemptUnknown(db,businessId,attempt.id,'station','secret spool payload',now)
  await resolveUnknownPrintAttempt(db,businessId,'job',attempt.id,'manual_not_printed','forged',now)
  await resolveUnknownPrintAttempt(db,businessId,'job',attempt.id,'manual_not_printed','forged',now)
  const events=sqlite.prepare("SELECT * FROM audit_events WHERE resource_type='print-job' AND resource_id='job'").all()
  assert.equal(events.filter(e=>e.action==='printing.submission.intent').length,1)
  assert.ok(events.some(e=>e.action==='printing.outcome.observed' && e.result==='unknown' && e.actor_type==='system' && e.actor_user_id===null))
  const resolution=events.filter(e=>e.action==='printing.outcome.resolved')
  assert.equal(resolution.length,1);assert.equal(resolution[0].actor_user_id,'actor');assert.equal(resolution[0].actor_name,'Original')
  assert.ok(!JSON.stringify(events).includes('secret spool payload'))
  assert.deepEqual((await loadPrintAttributions(db,businessId,['job'])).get('job').lastActionBy,
    {type:'user',userId:'actor',displayName:'Original'})
  sqlite.exec("UPDATE print_stations SET recovery_state='active',recovery_job_id='job'; CREATE TRIGGER reject_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END")
  await assert.rejects(claimNextRecoveryPrintJob(db,businessId,'station',now),/audit unavailable/)
  assert.equal(sqlite.prepare("SELECT recovery_state FROM print_stations").get().recovery_state,'active')
  assert.equal(sqlite.prepare("SELECT status FROM print_jobs WHERE id='job'").get().status,'pending')
})

test('table transfer and idempotent policy save retain linked actor; audit failure preserves the policy revision',async t=>{
  const {db,sqlite}=await setup(t),at=now.toISOString()
  for(const id of ['source','destination'])sqlite.prepare('INSERT INTO tables(id,business_id,name,name_key,sort_order,is_active,created_at,updated_at) VALUES(?,?,?,?,1,1,?,?)').run(id,businessId,id,id,at,at)
  sqlite.prepare("INSERT INTO table_tabs(id,business_id,table_id,table_identifier,status,opened_at,created_at,updated_at,tab_number) VALUES('tab',?,'source','source','open',?,?,?,1)").run(businessId,at,at,at)
  await transferOpenTableTab(db,businessId,'source','destination',now,'tab')
  const transfer=sqlite.prepare("SELECT * FROM audit_events WHERE action='table-tab.transferred'").get()
  assert.equal(transfer.actor_user_id,'actor');assert.equal(transfer.actor_name,'Original');assert.equal(transfer.resource_id,'tab')
  const initial=await loadOperations(db,businessId)
  const input={expectedRevision:initial.revision,mutationId:'policy-change',data:initial.data}
  await saveOperations(db,businessId,input,now);await saveOperations(db,businessId,input,now)
  assert.equal(sqlite.prepare("SELECT count(*) n FROM audit_events WHERE action='settings.operations.updated'").get().n,1)
  const updated=await loadOperations(db,businessId)
  sqlite.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END")
  await assert.rejects(saveOperations(db,businessId,{...input,mutationId:'reject',expectedRevision:updated.revision},now),{code:'SETTINGS_UNAVAILABLE'})
  assert.equal((await loadOperations(db,businessId)).revision,updated.revision)
})

test('HTTP mutators use authenticated identity and denial and logout emit minimal security history',async t=>{
  const {db,sqlite}=await setup(t)
  sqlite.prepare("UPDATE users SET login_normalized='actor@example.test',email_verified_at=? WHERE id='actor'").run(now.toISOString())
  sqlite.exec("UPDATE business_auth_state SET mode='user_only'; INSERT INTO user_credentials(business_id,user_id,password_verifier,password_changed_at,created_at,updated_at) VALUES('amor-e-sabor','actor','fixture','2026-09-30','2026-09-30','2026-09-30')")
  const env={DB:db},session=await createUserSession(env,{businessId,userId:'actor'})
  const call=(path,method,body)=>handleRequest(new Request(`https://delivery.test${path}`,{method,headers:{cookie:`amor_session=${session.token}`,origin:'https://delivery.test','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env)
  const created=await call('/api/clients','POST',{name:'HTTP client',actorLabel:'forged',userId:'evil',businessId:'evil'})
  assert.equal(created.status,201)
  const event=sqlite.prepare("SELECT * FROM audit_events WHERE action='client.created'").get()
  assert.equal(event.actor_user_id,'actor');assert.equal(event.actor_name,'Original')
  sqlite.prepare("INSERT INTO print_stations(id,business_id,name,platform,is_primary,auto_print_enabled,default_copies,created_at,updated_at) VALUES('http-station',?,'Printer','windows',1,1,1,?,?)").run(businessId,now.toISOString(),now.toISOString())
  const printed=await call('/api/printing/test-jobs','POST',{stationId:'http-station',actorLabel:'forged'})
  assert.equal(printed.status,201)
  const printPayload=await printed.json()
  assert.deepEqual(printPayload.job.attribution.requestedBy,{type:'user',userId:'actor',displayName:'Original'})
  sqlite.exec("UPDATE users SET role_id='amor-e-sabor:operator' WHERE id='actor'")
  assert.equal((await call('/api/access/activity','GET')).status,403)
  assert.equal((await call('/api/auth/logout','POST')).status,200)
  assert.equal(sqlite.prepare("SELECT count(*) n FROM audit_events WHERE action='access.denied'").get().n,1)
  assert.equal(sqlite.prepare("SELECT count(*) n FROM audit_events WHERE action='session.revoked'").get().n,1)
  assert.equal(sqlite.prepare("SELECT metadata_json FROM audit_events WHERE action='session.revoked'").get().metadata_json,'{}')
})


for (const submitted of [true,false]) test(`queue timeout atomically audits system uncertainty and replay is inert (submitted=${submitted})`,async t=>{
  const {db,sqlite}=await setup(t),at=now.toISOString()
  sqlite.prepare("INSERT INTO print_stations(id,business_id,name,platform,is_primary,auto_print_enabled,default_copies,created_at,updated_at) VALUES('timeout-station',?,'Printer','windows',1,1,1,?,?)").run(businessId,at,at)
  sqlite.prepare("INSERT INTO print_jobs(id,business_id,type,trigger,status,copies_requested,copies_printed,station_id,snapshot_json,created_at,available_at,processing_started_at) VALUES('timeout-job',?,'test','manual','processing',1,0,'timeout-station','{}',?,?,?)").run(businessId,at,at,at)
  let attempt
  if(submitted){
    attempt=await createPrintJobAttempt(db,businessId,{jobId:'timeout-job',stationId:'timeout-station',copyNumber:1},now)
    await markPrintAttemptSubmitting(db,businessId,attempt.id,'timeout-station',now)
  }
  const before=sqlite.prepare("SELECT count(*) n FROM audit_events").get().n
  await listPrintJobs(db,businessId,{now})
  assert.equal(sqlite.prepare("SELECT count(*) n FROM audit_events").get().n,before)
  sqlite.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END")
  const later=new Date(now.getTime()+180000)
  await assert.rejects(listPrintJobs(db,businessId,{now:later}),/audit unavailable/)
  assert.equal(sqlite.prepare("SELECT status FROM print_jobs WHERE id='timeout-job'").get().status,submitted?'awaiting_confirmation':'processing')
  if(submitted)assert.equal(sqlite.prepare('SELECT status FROM print_job_attempts WHERE id=?').get(attempt.id).status,'submitting')
  sqlite.exec("DROP TRIGGER reject_audit; CREATE TRIGGER reject_timeout_job BEFORE UPDATE ON print_jobs WHEN NEW.status='requires_attention' BEGIN SELECT RAISE(ABORT,'job unavailable'); END")
  await assert.rejects(listPrintJobs(db,businessId,{now:later}),/job unavailable/)
  assert.equal(sqlite.prepare("SELECT count(*) n FROM audit_events WHERE action='printing.outcome.observed' AND resource_id='timeout-job'").get().n,0)
  if(submitted)assert.equal(sqlite.prepare('SELECT status FROM print_job_attempts WHERE id=?').get(attempt.id).status,'submitting')
  sqlite.exec('DROP TRIGGER reject_timeout_job')
  await listPrintJobs(db,businessId,{now:later})
  await listPrintJobs(db,businessId,{now:new Date(later.getTime()+1000)})
  assert.equal(sqlite.prepare("SELECT status FROM print_jobs WHERE id='timeout-job'").get().status,'requires_attention')
  if(submitted)assert.equal(sqlite.prepare('SELECT status FROM print_job_attempts WHERE id=?').get(attempt.id).status,'unknown')
  const events=sqlite.prepare("SELECT * FROM audit_events WHERE action='printing.outcome.observed' AND resource_id='timeout-job'").all()
  assert.equal(events.length,1)
  assert.equal(events[0].result,'unknown');assert.equal(events[0].actor_type,'system');assert.equal(events[0].actor_user_id,null)
  assert.deepEqual(JSON.parse(events[0].metadata_json),{stationId:'timeout-station'})
})

test('timeout audit never adopts a stored station from a different tenant',async t=>{
  const {db,sqlite}=await setup(t),at=now.toISOString()
  sqlite.prepare("INSERT INTO businesses(id,slug,name,created_at,updated_at) VALUES('foreign','foreign','Foreign',?,?)").run(at,at)
  sqlite.prepare("INSERT INTO print_stations(id,business_id,name,platform,is_primary,auto_print_enabled,default_copies,created_at,updated_at) VALUES('foreign-station','foreign','Printer','windows',1,1,1,?,?)").run(at,at)
  sqlite.prepare("INSERT INTO print_jobs(id,business_id,type,trigger,status,copies_requested,copies_printed,station_id,snapshot_json,created_at,available_at,processing_started_at) VALUES('foreign-station-job',?,'test','manual','processing',1,0,'foreign-station','{}',?,?,?)").run(businessId,at,at,at)
  await listPrintJobs(db,businessId,{now:new Date(now.getTime()+180000)})
  const event=sqlite.prepare("SELECT * FROM audit_events WHERE resource_id='foreign-station-job'").get()
  assert.equal(event.business_id,businessId);assert.equal(event.actor_type,'system')
  assert.equal(event.actor_user_id,null);assert.equal(event.metadata_json,'{}')
})
