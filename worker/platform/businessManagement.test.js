import test from 'node:test'
import assert from 'node:assert/strict'
import { createManagementFixture } from '../test-support/companyManagementDb.js'
import { performBusinessManagement } from './managementCommands.js'
import { loadAccountSessionRow } from '../identity/sessions.js'

const action=(f,operation,revision,extra={})=>performBusinessManagement({DB:f.db},f.contexts.admin,{businessId:f.businesses.A,operation},{reason:'Manutenção administrativa',expectedRevision:revision,...extra},{idempotencyKey:crypto.randomUUID(),now:f.now})

test('suspend/delete/restore preserve accounts and another company while old sessions stay revoked', async t => {
  const f=await createManagementFixture(t),credentials=f.sqlite.prepare('SELECT * FROM account_credentials').all()
  await action(f,'suspend',0)
  assert.equal(await loadAccountSessionRow(f.db,f.contexts.aliceA.identitySessionId,f.now),null)
  assert.ok(await loadAccountSessionRow(f.db,f.contexts.aliceB.identitySessionId,f.now))
  await action(f,'delete',1,{confirmationName:'Company A'})
  await action(f,'restore',2)
  const row=f.sqlite.prepare('SELECT * FROM businesses WHERE id=?').get(f.businesses.A)
  assert.equal(row.lifecycle_status,'suspended')
  assert.equal(row.access_status,'active')
  assert.equal(row.management_revision,3)
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM account_credentials').all(),credentials)
  await action(f,'resume',3)
  assert.equal(f.sqlite.prepare('SELECT lifecycle_status FROM businesses WHERE id=?').get(f.businesses.A).lifecycle_status,'enabled')
  assert.equal(await loadAccountSessionRow(f.db,f.contexts.aliceA.identitySessionId,f.now),null)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM platform_audit_events').get().n,4)
})

test('resume never activates pending registration and active resume needs a capable manager', async t => {
  const f=await createManagementFixture(t)
  f.sqlite.prepare("UPDATE businesses SET access_status='pending' WHERE id=?").run(f.businesses.A)
  await action(f,'suspend',0); await action(f,'resume',1)
  assert.equal(f.sqlite.prepare('SELECT access_status FROM businesses WHERE id=?').get(f.businesses.A).access_status,'pending')
  f.sqlite.prepare("UPDATE businesses SET access_status='active',lifecycle_status='suspended' WHERE id=?").run(f.businesses.A)
  f.sqlite.prepare('UPDATE users SET active=0 WHERE id=?').run(f.members.aliceA)
  await assert.rejects(action(f,'resume',2),{code:'LAST_MANAGER'})
  assert.equal(f.sqlite.prepare('SELECT management_revision FROM businesses WHERE id=?').get(f.businesses.A).management_revision,2)
})

test('delete requires current name, revision and one event across replay', async t => {
  const f=await createManagementFixture(t),key=crypto.randomUUID(),target={businessId:f.businesses.A,operation:'delete'},options={idempotencyKey:key,now:f.now}
  await assert.rejects(action(f,'delete',0,{confirmationName:'company a'}),{status:400})
  const input={reason:'Empresa duplicada',expectedRevision:0,confirmationName:' Company A '}
  await performBusinessManagement({DB:f.db},f.contexts.admin,target,input,options)
  await performBusinessManagement({DB:f.db},f.contexts.admin,target,input,options)
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM platform_audit_events').get().n,1)
  await assert.rejects(action(f,'suspend',1),{status:409})
})
