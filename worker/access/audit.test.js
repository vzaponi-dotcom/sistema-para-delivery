import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from '../test-support/settingsDb.js'
import { recordSecurityEvent } from './audit.js'
import * as audit from './audit.js'

test('official business mutation and safe resource-linked audit roll back together', async t => {
  const {db,sqlite,close}=createSettingsDb();t.after(close)
  assert.equal(typeof audit.prepareAuditEvent,'function')
  const context={businessId:'amor-e-sabor',legacy:true,displayName:'Acesso legado'}
  const event=()=>audit.prepareAuditEvent(db,context,{action:'client.created',resourceType:'client',resourceId:'c',outcome:'success',metadata:{password:'secret',token:'secret',actorLabel:'forged',address:'private'}})
  sqlite.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END")
  const statement=()=>db.prepare("INSERT INTO clients(id,business_id,name,created_at,updated_at) VALUES('c','amor-e-sabor','Client','2026-09-30','2026-09-30')")
  await assert.rejects(db.batch([statement(),event()]),/audit unavailable/)
  assert.equal(sqlite.prepare("SELECT count(*) n FROM clients WHERE id='c'").get().n,0)
  sqlite.exec('DROP TRIGGER reject_audit')
  await db.batch([statement(),event()])
  const row=sqlite.prepare('SELECT * FROM audit_events').get()
  assert.equal(row.resource_id,'c');assert.equal(row.actor_name,'Acesso legado');assert.deepEqual(JSON.parse(row.metadata_json),{})
})
test('security events only persist allowlisted minimal metadata', async(t)=>{
  const {db,sqlite,close}=createSettingsDb();t.after(close)
  await recordSecurityEvent(db,{businessId:'amor-e-sabor',action:'login.blocked',result:'blocked',metadata:{deviceMode:'shared',password:'secret',identifier:'person',token:'raw',origin:'ip'}})
  const row=sqlite.prepare('SELECT * FROM audit_events').get()
  assert.equal(row.actor_type,'system');assert.deepEqual(JSON.parse(row.metadata_json),{deviceMode:'shared'})
})
