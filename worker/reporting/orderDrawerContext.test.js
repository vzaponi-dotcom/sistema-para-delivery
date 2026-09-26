import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from '../test-support/settingsDb.js'

test('reporting order detail exposes official history fields plus registered-client relationship context', async (t) => {
  const { createReportingRepository } = await import('./repository.js')
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  const at = '2026-09-25T22:42:00.000Z'

  sqlite.exec(`
    INSERT INTO businesses (id,slug,name,created_at,updated_at)
    VALUES ('a','a','Amor & Sabor','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z');
    INSERT INTO clients (id,business_id,name,phone,address,created_at,updated_at)
    VALUES ('c1','a','Teles Atual','3131656549','Rua Atual','${at}','${at}');

    INSERT INTO orders (
      id,business_id,client_id,client_name_snapshot,client_phone_snapshot,client_address_snapshot,
      order_number,order_date,type,status,subtotal_cents,delivery_fee_cents,adjustment_type,
      adjustment_mode,adjustment_value,adjustment_amount_cents,total_cents,created_at,finished_at,
      cancelled_at,is_backdated
    ) VALUES
      ('o1','a','c1','Teles','(31) 31656-5949','Rua Antiga',186,'2026-09-25','Retirada','Em preparo',10000,0,'none','fixed',0,0,10000,'${at}',NULL,NULL,0),
      ('o2','a','c1','Teles','(31) 31656-5949','Rua Antiga',173,'2026-09-18','Entrega','Finalizado',5000,0,'none','fixed',0,0,5000,'2026-09-18T18:00:00Z','2026-09-18T18:40:00Z',NULL,0),
      ('o3','a','c1','Teles','(31) 31656-5949','Rua Antiga',119,'2026-09-02','Entrega','Cancelado',3000,0,'none','fixed',0,0,3000,'2026-09-02T18:00:00Z',NULL,'2026-09-02T18:10:00Z',0);

    INSERT INTO order_items (id,business_id,order_id,name_snapshot,category_snapshot,size_snapshot,quantity,catalog_price_cents,unit_price_cents,created_at)
    VALUES ('i1','a','o1','Combo Família','Combos','Un',1,10000,10000,'${at}');

    INSERT INTO payment_receipts (id,business_id,total_cents,paid_at,created_at)
    VALUES ('r1','a',2000,'2026-09-25T22:44:00Z','2026-09-25T22:44:00Z');
    INSERT INTO payment_allocations (id,business_id,receipt_id,method_code,method_label,amount_cents,created_at)
    VALUES ('pa1','a','r1',NULL,'Pix',2000,'2026-09-25T22:44:00Z');
    INSERT INTO payments (id,business_id,order_id,receipt_id,method,amount_cents,paid_at,created_at)
    VALUES ('p1','a','o1','r1',NULL,2000,'2026-09-25T22:44:00Z','2026-09-25T22:44:00Z');
  `)

  const result = await createReportingRepository(db).getOrderDetail('a', 'o1')
  assert.equal(result.client_id, 'c1')
  assert.equal(result.paidCents, 2000)
  assert.equal(result.pendingCents, 8000)
  assert.equal(result.paymentAllocations[0].paid_at, '2026-09-25T22:44:00Z')
  assert.equal(result.clientContext.profile.name, 'Teles Atual')
  assert.equal(result.clientContext.profile.address, 'Rua Atual')
  assert.deepEqual(result.clientContext.summary, {
    ordersCount: 3,
    totalSpentCents: 15000,
    averageTicketCents: 7500,
    pendingCents: 13000,
    cancellationCount: 1,
    lastPurchaseDate: '2026-09-25',
  })
  assert.deepEqual(result.clientContext.orders.map((order) => order.id), ['o1', 'o2', 'o3'])
})