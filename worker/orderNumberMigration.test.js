import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL('../migrations/0017_order_numbers.sql', import.meta.url)

test('order number migration adds the operational number column and deterministic backfill', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  assert.match(sql, /ALTER TABLE orders ADD COLUMN order_number INTEGER/i)
  assert.match(sql, /ROW_NUMBER\s*\(\)\s*OVER\s*\(\s*PARTITION BY business_id\s+ORDER BY created_at ASC, id ASC\s*\)/i)
})

test('order number migration protects business-scoped uniqueness and initializes persisted counters', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  assert.match(sql, /CREATE UNIQUE INDEX[\s\S]*orders[\s\S]*business_id[\s\S]*order_number/i)
  assert.match(sql, /CREATE TABLE[\s\S]*order_sequences/i)
  assert.match(sql, /MAX\s*\(\s*order_number\s*\)/i)
  assert.match(sql, /INSERT INTO order_sequences/i)
})
