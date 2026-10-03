import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from '../test-support/settingsDb.js'
import { handleAccessApi } from './api.js'
import * as audit from './audit.js'

const businessId = 'amor-e-sabor'
test('activity denies operators and pages only the trusted business without session identifiers', async t => {
  const { db, sqlite, close } = createSettingsDb(); t.after(close)
  const request = new Request('https://delivery.test/api/access/activity?limit=1')
  await assert.rejects(handleAccessApi(request, { DB: db }, { businessId, granted: new Set() }, new URL(request.url)), { status: 403 })
  for (const id of ['a','b']) sqlite.prepare(`INSERT INTO audit_events(id,business_id,occurred_at,actor_type,actor_name,action,resource_type,resource_id,result) VALUES(?,?,'2026-09-30T00:00:00.000Z','legacy','Acesso legado','order.created','order',?,'success')`).run(id,businessId,id)
  sqlite.exec("INSERT INTO businesses(id,slug,name,created_at,updated_at) VALUES('other','other','Other','2026-09-30','2026-09-30'); INSERT INTO audit_events(id,business_id,occurred_at,actor_type,actor_name,action,result) VALUES('z','other','2026-09-30T00:00:00.000Z','system','Sistema','order.created','success')")
  const context = { businessId, granted: new Set(['access.audit.view']) }
  const result = await (await handleAccessApi(request,{DB:db},context,new URL(request.url))).json()
  assert.equal(result.items.length,1); assert.ok(result.nextCursor)
  assert.equal(result.items[0].resourceId,'b')
  assert.equal(Object.hasOwn(result.items[0],'sessionId'),false)
  const next = await audit.listActivity(db,businessId,{cursor:result.nextCursor,limit:1,type:'order.created'})
  assert.equal(next.items.length,1); assert.notEqual(next.items[0].id,result.items[0].id)
  assert.equal(next.nextCursor,null)
  assert.equal((await audit.listActivity(db,businessId,{from:'2026-10-01',to:'2026-10-02'})).items.length,0)
  assert.equal((await audit.listActivity(db,businessId,{userId:'foreign'})).items.length,0)
  await assert.rejects(audit.listActivity(db,businessId,{limit:101}),{status:400})
})
