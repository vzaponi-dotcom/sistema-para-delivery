import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('finance migration adds movement metadata and opening settings', async () => {
  const sql = await readFile(new URL('../migrations/0009_finance_cash_flow.sql', import.meta.url), 'utf8')
  assert.match(sql, /ALTER TABLE movements ADD COLUMN payment_method TEXT/i)
  assert.match(sql, /ALTER TABLE movements ADD COLUMN updated_at TEXT/i)
  assert.match(sql, /ALTER TABLE movements ADD COLUMN deleted_at TEXT/i)
  assert.match(sql, /UPDATE movements SET updated_at = created_at WHERE updated_at IS NULL/i)
  assert.match(sql, /CREATE TABLE finance_settings/i)
  assert.match(sql, /opening_balance_cents INTEGER NOT NULL/i)
  assert.match(sql, /opening_date TEXT NOT NULL/i)
})
