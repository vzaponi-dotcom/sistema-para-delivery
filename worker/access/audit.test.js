import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from '../test-support/settingsDb.js'
import { recordSecurityEvent } from './audit.js'
test('security events only persist allowlisted minimal metadata', async(t)=>{
  const {db,sqlite,close}=createSettingsDb();t.after(close)
  await recordSecurityEvent(db,{businessId:'amor-e-sabor',action:'login.blocked',result:'blocked',metadata:{deviceMode:'shared',password:'secret',identifier:'person',token:'raw',origin:'ip'}})
  const row=sqlite.prepare('SELECT * FROM audit_events').get()
  assert.equal(row.actor_type,'system');assert.deepEqual(JSON.parse(row.metadata_json),{deviceMode:'shared'})
})
