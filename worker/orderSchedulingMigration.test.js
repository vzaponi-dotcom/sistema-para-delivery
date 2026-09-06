import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../migrations/0011_scheduled_orders_operational_timing.sql', import.meta.url)

test('scheduled order timing migration adds scheduling fields and legacy backfills', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  assert.match(sql, /ALTER TABLE orders ADD COLUMN scheduled_for TEXT/i)
  assert.match(sql, /ALTER TABLE orders ADD COLUMN is_backdated INTEGER NOT NULL DEFAULT 0 CHECK \(is_backdated IN \(0,1\)\)/i)
  assert.match(sql, /ALTER TABLE print_jobs ADD COLUMN available_at TEXT/i)
  assert.match(sql, /UPDATE print_jobs SET available_at = created_at WHERE available_at IS NULL/i)
  assert.match(sql, /UPDATE orders SET is_backdated = 1[\s\S]*WHERE status = 'Finalizado'[\s\S]*finished_at = created_at[\s\S]*created_at = order_date \|\| 'T15:00:00\.000Z'/i)
  assert.match(sql, /CREATE INDEX orders_business_schedule_idx ON orders \(business_id, scheduled_for\)/i)
  assert.match(sql, /CREATE INDEX print_jobs_available_idx ON print_jobs \(business_id, status, trigger, available_at\)/i)
})
