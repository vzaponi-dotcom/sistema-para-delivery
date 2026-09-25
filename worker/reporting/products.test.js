import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from '../test-support/settingsDb.js'

test('snapshot fallback identity cannot collide on separator characters', async () => {
  const { productIdentity } = await import('./productAnalytics.js')
  assert.notEqual(productIdentity({ category_snapshot: 'a|b', name_snapshot: 'c', size_snapshot: '' }),
    productIdentity({ category_snapshot: 'a', name_snapshot: 'b|c', size_snapshot: '' }))
})

test('product quality reports invalid allocation and preserves renamed historical labels', async () => {
  const { calculateProducts } = await import('./productAnalytics.js')
  const row = (order_id, item_id, name_snapshot, unit_price_cents, total_cents) => ({
    order_id, item_id, product_id: 'p1', name_snapshot, category_snapshot: 'Refeições', size_snapshot: '',
    quantity: 1, unit_price_cents, total_cents, delivery_fee_cents: 0,
  })
  const result = calculateProducts([row('o1', 'i1', 'Nome antigo', 1000, 1000), row('o2', 'i2', 'Nome novo', 1000, 1000), row('o3', 'i3', 'Nome novo', 0, 500)])
  assert.equal(result.ranking.length, 1)
  assert.deepEqual(result.ranking[0].labels, ['Nome antigo', 'Nome novo'])
  assert.equal(result.invalidAllocationOrderCount, 1)
  assert.equal(result.merchandiseRevenueCents, 2000)
})

test('products aggregate historical snapshots, allocate merchandise only and expose prior growth', async (t) => {
  const { createReportingRepository } = await import('./repository.js')
  const { createReportingService } = await import('./service.js')
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  sqlite.exec(`
    INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES ('a','a','A','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z');
    INSERT INTO orders (id,business_id,order_number,client_name_snapshot,order_date,type,status,subtotal_cents,delivery_fee_cents,adjustment_type,adjustment_mode,adjustment_value,adjustment_amount_cents,total_cents,created_at) VALUES
      ('old','a',1,'Ana','2026-08-10','Entrega','Finalizado',1000,200,'none','fixed',0,0,1200,'2026-08-10T12:00:00Z'),
      ('new','a',2,'Ana','2026-09-10','Entrega','Finalizado',2000,300,'none','fixed',0,0,2300,'2026-09-10T12:00:00Z'),
      ('cancel','a',3,'Ana','2026-09-10','Entrega','Cancelado',900,0,'none','fixed',0,0,900,'2026-09-10T13:00:00Z');
    INSERT INTO order_items (id,business_id,order_id,product_id,name_snapshot,category_snapshot,size_snapshot,quantity,catalog_price_cents,unit_price_cents,created_at) VALUES
      ('old-item','a','old',NULL,'Marmita antiga','Marmita','Grande',1,1000,1000,'2026-08-10T12:00:00Z'),
      ('new-item','a','new',NULL,'Marmita antiga','Marmita','Grande',2,1000,1000,'2026-09-10T12:00:00Z'),
      ('cancel-item','a','cancel',NULL,'Outro','Lanches','',1,900,900,'2026-09-10T13:00:00Z');
  `)
  const result = await createReportingService(createReportingRepository(db)).products('a', {
    from: '2026-09-01', to: '2026-09-30', period: 'current-month',
  })
  assert.equal(result.data.unitsSold, 2)
  assert.equal(result.data.mealsSold, 2)
  assert.equal(result.data.merchandiseRevenueCents, 2000)
  assert.equal(result.data.top10.length, 1)
  assert.equal(result.data.top10[0].revenueCents, 2000)
  assert.equal(result.data.top10[0].growthPercent, 100)
  assert.equal(result.data.categories[0].category, 'Marmita')
  assert.equal(result.data.presentations[0].size, 'Grande')
})
