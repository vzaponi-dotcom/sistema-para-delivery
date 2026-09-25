import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from '../test-support/settingsDb.js'

test('detail keeps server pagination and totals separate', async () => {
  const { createReportingService } = await import('./service.js')
  const repository = { async listDetail() { return { total: 3, items: [{ id: 'two' }] } } }
  const result = await createReportingService(repository).detail('business-a', { page: 2, pageSize: 1 })
  assert.deepEqual(result.data, { total: 3, page: 2, pageSize: 1, totalPages: 3, items: [{ id: 'two' }] })
})

test('detail combines server filters, canonical late policy, allowlisted sort and business-scoped drawer', async (t) => {
  const { createReportingRepository } = await import('./repository.js')
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  sqlite.exec(`
    INSERT INTO businesses (id,slug,name,created_at,updated_at) VALUES ('a','a','A','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z'),('b','b','B','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z');
    INSERT INTO orders (id,business_id,order_number,client_name_snapshot,order_date,type,status,subtotal_cents,delivery_fee_cents,adjustment_type,adjustment_mode,adjustment_value,adjustment_amount_cents,total_cents,created_at,finished_at) VALUES
      ('late','a',1,'Ana','2026-09-10','Entrega','Finalizado',1000,0,'none','fixed',0,0,1000,'2026-09-10T12:00:00Z','2026-09-10T12:45:00Z'),
      ('fast','a',2,'Ana','2026-09-10','Entrega','Finalizado',2000,0,'none','fixed',0,0,2000,'2026-09-10T12:00:00Z','2026-09-10T12:20:00Z'),
      ('other','b',3,'Ana','2026-09-10','Entrega','Finalizado',9000,0,'none','fixed',0,0,9000,'2026-09-10T12:00:00Z','2026-09-10T13:00:00Z');
    INSERT INTO order_items (id,business_id,order_id,name_snapshot,category_snapshot,size_snapshot,quantity,catalog_price_cents,unit_price_cents,created_at) VALUES
      ('item-1','a','late','X','Lanches','',1,1000,1000,'2026-09-10T12:00:00Z');
    INSERT INTO payment_receipts (id,business_id,total_cents,paid_at,created_at) VALUES ('r','a',1000,'2026-09-10T13:00:00Z','2026-09-10T13:00:00Z');
    INSERT INTO payment_allocations (id,business_id,receipt_id,method_label,amount_cents,created_at) VALUES ('al','a','r','Pix',1000,'2026-09-10T13:00:00Z');
    INSERT INTO payments (id,business_id,order_id,receipt_id,amount_cents,method,paid_at,created_at) VALUES ('p','a','late','r',1000,NULL,'2026-09-10T13:00:00Z','2026-09-10T13:00:00Z');
  `)
  const repo = createReportingRepository(db)
  const base = { from: '2026-09-10', to: '2026-09-10', page: 1, pageSize: 1, sort: 'total-desc' }
  const first = await repo.listDetail('a', base)
  assert.equal(first.total, 2)
  assert.equal(first.items[0].id, 'fast')
  const second = await repo.listDetail('a', { ...base, page: 2 })
  assert.equal(second.items[0].id, 'late')
  const filtered = await repo.listDetail('a', {
    ...base, status: 'Finalizado', type: 'Entrega', schedule: 'immediate', paymentMethod: 'Pix',
    category: 'Lanches', product: '["Lanches","X",""]', customer: 'Ana', search: 'Ana',
    orderHourFrom: 9, orderHourTo: 9, operationalDeadline: 'late',
  })
  assert.equal(filtered.total, 1)
  assert.equal(filtered.items[0].id, 'late')
  assert.equal(filtered.items[0].onTime, false)
  assert.equal((await repo.getOrderDetail('a', 'late')).items.length, 1)
  assert.equal((await repo.getOrderDetail('a', 'late')).paymentAllocations[0].method_label, 'Pix')
  assert.equal(await repo.getOrderDetail('b', 'late'), null)
})
