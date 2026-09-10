import assert from 'node:assert/strict'
import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'

const migrationUrl = new URL('../migrations/0020_table_tab_numbers.sql', import.meta.url)

function createBaseSchema(database) {
  database.exec(`
    CREATE TABLE businesses (
      id TEXT PRIMARY KEY
    );

    CREATE TABLE table_tabs (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      table_identifier TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT INTO businesses (id) VALUES ('biz');
    INSERT INTO table_tabs (
      id, business_id, table_identifier, status, opened_at, closed_at, created_at, updated_at
    ) VALUES
      ('tab-2', 'biz', '2', 'closed', '2026-01-02T10:00:00.000Z', NULL, '2026-01-02T10:00:01.000Z', '2026-01-02T10:00:01.000Z'),
      ('tab-1', 'biz', '1', 'closed', '2026-01-01T10:00:00.000Z', NULL, '2026-01-01T10:00:01.000Z', '2026-01-01T10:00:01.000Z');
  `)
}

function createStagingExtras(database) {
  database.exec(`
    CREATE TABLE print_stations (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE print_jobs (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      status TEXT NOT NULL
    );

    ALTER TABLE table_tabs ADD COLUMN table_id TEXT;
    ALTER TABLE table_tabs ADD COLUMN tab_source TEXT;
  `)
}

function applyMigration(database) {
  database.exec(fs.readFileSync(migrationUrl, 'utf8'))
}

test('0020 numbers existing tabs deterministically and creates a business counter', () => {
  assert.equal(fs.existsSync(migrationUrl), true)
  const sql = fs.readFileSync(migrationUrl, 'utf8')
  assert.match(sql, /ALTER TABLE table_tabs ADD COLUMN tab_number INTEGER/i)
  assert.match(sql, /row_number\(\) OVER\s*\(PARTITION BY business_id ORDER BY opened_at, created_at, id\)/i)
  assert.match(sql, /CREATE TABLE table_tab_counters/i)
  assert.match(sql, /CREATE UNIQUE INDEX idx_table_tabs_business_number\s+ON table_tabs\s*\(business_id, tab_number\)/i)
  assert.doesNotMatch(sql, /print_jobs|print_stations|business_print_settings/i)
})

test('0020 applies to production and staging schema states and backfills counters', () => {
  for (const staging of [false, true]) {
    const database = new DatabaseSync(':memory:')
    try {
      createBaseSchema(database)
      if (staging) createStagingExtras(database)

      applyMigration(database)

      assert.deepEqual(
        database.prepare('SELECT tab_number FROM table_tabs ORDER BY opened_at, id').all().map((row) => row.tab_number),
        [1, 2],
      )
      assert.equal(
        database.prepare("SELECT last_number FROM table_tab_counters WHERE business_id = 'biz'").get().last_number,
        2,
      )
      assert.deepEqual(
        database.prepare('PRAGMA table_info(table_tabs)').all().filter((row) => row.name === 'tab_number').map((row) => row.type),
        ['INTEGER'],
      )
    } finally {
      database.close()
    }
  }
})
