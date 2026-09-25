import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from '../test-support/settingsDb.js'

test('reporting repository scopes every base read to the authenticated business', async (t) => {
  const { createReportingRepository } = await import('./repository.js')
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  sqlite.exec("INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES ('business-a', 'a', 'A', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'), ('business-b', 'b', 'B', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'); INSERT INTO orders (id, business_id, order_number, client_name_snapshot, order_date, type, status, subtotal_cents, delivery_fee_cents, adjustment_type, adjustment_mode, adjustment_value, adjustment_amount_cents, total_cents, created_at) VALUES ('a', 'business-a', 1, 'Ana', '2026-09-10', 'Entrega', 'Finalizado', 1000, 0, 'none', 'fixed', 0, 0, 1000, '2026-09-10T12:00:00.000Z'), ('b', 'business-b', 2, 'Bia', '2026-09-10', 'Entrega', 'Finalizado', 2000, 0, 'none', 'fixed', 0, 0, 2000, '2026-09-10T12:00:00.000Z')")
  const repository = createReportingRepository(db)
  const rows = await repository.listOrders('business-a', { from: '2026-09-01', to: '2026-09-30' })
  assert.deepEqual(rows.map((row) => row.id), ['a'])
})

test('overview reads receipts once and only official refunds for the selected business and dates', async (t) => {
  const { createReportingRepository } = await import('./repository.js')
  const { db, sqlite, close } = createSettingsDb()
  t.after(close)
  sqlite.exec(`
    INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES
      ('business-a', 'a', 'A', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
      ('business-b', 'b', 'B', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
    INSERT INTO orders (id, business_id, order_number, client_name_snapshot, order_date, type, status, subtotal_cents, delivery_fee_cents, adjustment_type, adjustment_mode, adjustment_value, adjustment_amount_cents, total_cents, created_at) VALUES
      ('order-a', 'business-a', 1, 'Ana', '2026-09-10', 'Entrega', 'Finalizado', 1000, 0, 'none', 'fixed', 0, 0, 1000, '2026-09-10T12:00:00.000Z'),
      ('order-b', 'business-b', 2, 'Bia', '2026-09-10', 'Entrega', 'Finalizado', 2000, 0, 'none', 'fixed', 0, 0, 2000, '2026-09-10T12:00:00.000Z');
    INSERT INTO payment_receipts (id, business_id, total_cents, paid_at, created_at) VALUES
      ('receipt-a', 'business-a', 1000, '2026-09-10T15:00:00.000Z', '2026-09-10T15:00:00.000Z'),
      ('receipt-b', 'business-b', 2000, '2026-09-10T15:00:00.000Z', '2026-09-10T15:00:00.000Z');
    INSERT INTO payment_allocations (id, business_id, receipt_id, method_label, amount_cents, created_at) VALUES
      ('allocation-a', 'business-a', 'receipt-a', 'Pix', 1000, '2026-09-10T15:00:00.000Z'),
      ('allocation-b', 'business-b', 'receipt-b', 'Pix', 2000, '2026-09-10T15:00:00.000Z');
    INSERT INTO payments (id, business_id, order_id, receipt_id, amount_cents, method, paid_at, created_at) VALUES
      ('payment-a', 'business-a', 'order-a', 'receipt-a', 1000, NULL, '2026-09-10T15:00:00.000Z', '2026-09-10T15:00:00.000Z');
    INSERT INTO movements (id, business_id, type, category, description, value_cents, source, order_id, movement_date, created_at) VALUES
      ('refund-a', 'business-a', 'saida', 'refunds', 'Estorno', 100, 'order-refund', 'order-a', '2026-09-10', '2026-09-10T16:00:00.000Z'),
      ('manual-a', 'business-a', 'saida', 'refunds', 'Manual', 900, 'manual', NULL, '2026-09-10', '2026-09-10T16:00:00.000Z');
  `)
  const result = await createReportingRepository(db).loadOverview('business-a', { from: '2026-09-01', to: '2026-09-30' })
  assert.equal(result.orders.length, 1)
  assert.equal(result.receipts[0].total_cents, 1000)
  assert.equal(result.refunds[0].value_cents, 100)
})
