import test from 'node:test'
import assert from 'node:assert/strict'
import { createTenancyFixture } from '../test-support/tenancyDb.js'
import { preparePlatformAudit } from './audit.js'

test('administrative audit stores only fixed events and bounded facts', async t => {
  const f = await createTenancyFixture(t)
  await preparePlatformAudit(f.db, f.contexts.admin, { action: 'business.created', businessId: f.businesses.A, now: f.now, token: 'sensitive-not-stored', password: 'sensitive-not-stored', providerPayload: {} }).run()
  const rows = f.sqlite.prepare('SELECT * FROM platform_audit_events').all()
  assert.equal(rows.length, 1)
  assert.equal(JSON.stringify(rows).includes('sensitive-not-stored'), false)
  assert.throws(() => preparePlatformAudit(f.db, f.contexts.aliceA, { action: 'business.created' }), { status: 403 })
  assert.throws(() => preparePlatformAudit(f.db, f.contexts.admin, { action: 'arbitrary' }), { status: 400 })
})

test('administrative management audit records reason and safe state facts without secrets', async t => {
  const f = await createTenancyFixture(t)
  await preparePlatformAudit(f.db,f.contexts.admin,{action:'business.suspended',businessId:f.businesses.A,reason:'Teste de suspensão',resourceType:'business',resourceId:f.businesses.A,metadata:{from:'enabled',to:'suspended',token:'secret',password:'secret'},now:f.now}).run()
  const row=f.sqlite.prepare('SELECT * FROM platform_audit_events').get()
  assert.equal(row.reason,'Teste de suspensão')
  assert.equal(row.resource_id,f.businesses.A)
  assert.deepEqual(JSON.parse(row.metadata_json),{from:'enabled',to:'suspended'})
})
