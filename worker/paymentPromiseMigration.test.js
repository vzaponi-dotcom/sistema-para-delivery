import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../migrations/0012_receivables_payment_promise.sql', import.meta.url)

test('payment promise migration is additive nullable and indexed without backfill', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /ALTER TABLE orders ADD COLUMN promised_payment_date TEXT/i)
  assert.match(sql, /CREATE INDEX orders_business_promised_payment_idx\s+ON orders \(business_id, promised_payment_date\)/i)
  assert.doesNotMatch(sql, /UPDATE orders/i)
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN/i)
})
