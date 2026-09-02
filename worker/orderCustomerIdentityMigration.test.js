import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sql = fs.readFileSync(new URL('../migrations/0006_order_customer_identity.sql', import.meta.url), 'utf8')

test('order customer identity migration is additive and preserves existing orders', () => {
  assert.match(sql, /ADD COLUMN customer_identity_type/)
  assert.match(sql, /DEFAULT 'registered_client'/)
  assert.match(sql, /WHERE client_id IS NULL/)
  assert.doesNotMatch(sql, /DELETE FROM orders|DROP TABLE orders/i)
})
