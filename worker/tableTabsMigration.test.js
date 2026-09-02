import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migrationUrl = new URL('../migrations/0007_table_tabs.sql', import.meta.url)

test('table tabs migration creates persistent table sessions without rewriting history', () => {
  assert.equal(fs.existsSync(migrationUrl), true)
  if (!fs.existsSync(migrationUrl)) return

  const sql = fs.readFileSync(migrationUrl, 'utf8')
  assert.match(sql, /CREATE TABLE table_tabs/i)
  assert.match(sql, /table_identifier TEXT NOT NULL/i)
  assert.match(sql, /status TEXT NOT NULL/i)
  assert.match(sql, /ADD COLUMN table_tab_id TEXT/i)
  assert.match(sql, /CREATE UNIQUE INDEX[\s\S]+business_id[\s\S]+table_identifier[\s\S]+WHERE status = 'open'/i)
  assert.doesNotMatch(sql, /UPDATE orders[\s\S]+table_tab_id|DELETE FROM orders|DROP TABLE orders/i)
})
