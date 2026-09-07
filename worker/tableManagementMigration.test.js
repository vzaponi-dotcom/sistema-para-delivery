import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migrationUrl = new URL('../migrations/0013_table_management.sql', import.meta.url)

function readMigration() {
  assert.equal(fs.existsSync(migrationUrl), true, 'table management migration must exist')
  return fs.readFileSync(migrationUrl, 'utf8')
}

test('table management migration creates persistent tables with normalized business-scoped names', () => {
  const sql = readMigration()

  assert.match(sql, /CREATE TABLE tables\s*\([\s\S]*?\bid TEXT PRIMARY KEY[\s\S]*?\bbusiness_id TEXT NOT NULL REFERENCES businesses\(id\)[\s\S]*?\bname TEXT NOT NULL[\s\S]*?\bname_key TEXT NOT NULL[\s\S]*?\bsort_order INTEGER NOT NULL[\s\S]*?\bis_active INTEGER NOT NULL[\s\S]*?\bcreated_at TEXT NOT NULL[\s\S]*?\bupdated_at TEXT NOT NULL[\s\S]*?\)/i)
  assert.match(sql, /CREATE UNIQUE INDEX idx_tables_business_name_key\s+ON tables\s*\(business_id, name_key\)/i)
})

test('table management migration seeds Mesa 1 through Mesa 7 for every existing business', () => {
  const sql = readMigration()

  for (let number = 1; number <= 7; number += 1) {
    assert.match(sql, new RegExp(`['"]Mesa ${number}['"]`, 'i'))
  }
  assert.match(sql, /INSERT(?: OR IGNORE)? INTO tables[\s\S]+SELECT[\s\S]+FROM businesses/i)
})

test('table management migration backfills stable table ids while preserving legacy snapshots', () => {
  const sql = readMigration()

  assert.match(sql, /ALTER TABLE table_tabs ADD COLUMN table_id TEXT REFERENCES tables\(id\)/i)
  assert.match(sql, /INSERT(?: OR IGNORE)? INTO tables[\s\S]+FROM table_tabs/i)
  assert.match(sql, /UPDATE table_tabs[\s\S]+SET table_id\s*=/i)
  assert.match(sql, /DROP INDEX IF EXISTS idx_table_tabs_one_open_per_table/i)
  assert.match(sql, /CREATE UNIQUE INDEX idx_table_tabs_one_open_per_table_id\s+ON table_tabs\s*\(business_id, table_id\)\s+WHERE status = 'open'/i)
  assert.doesNotMatch(sql, /UPDATE table_tabs\s+SET table_identifier\s*=/i)
})

test('table management migration never destroys table tab history', () => {
  const sql = readMigration()

  assert.doesNotMatch(sql, /DROP TABLE(?: IF EXISTS)? table_tabs/i)
  assert.doesNotMatch(sql, /DELETE FROM table_tabs/i)
})
