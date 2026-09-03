import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL('../migrations/0008_order_cancellation_refunds.sql', import.meta.url)

test('order cancellation migration adds cancellation metadata and refund uniqueness guard', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  assert.match(sql, /ALTER TABLE orders ADD COLUMN cancelled_at TEXT/i)
  assert.match(sql, /ALTER TABLE orders ADD COLUMN cancel_reason TEXT/i)
  assert.match(sql, /ALTER TABLE orders ADD COLUMN cancel_reason_note TEXT/i)
  assert.match(sql, /CREATE UNIQUE INDEX[\s\S]*movements[\s\S]*business_id[\s\S]*order_id[\s\S]*order-refund/i)
})
