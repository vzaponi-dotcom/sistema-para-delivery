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
