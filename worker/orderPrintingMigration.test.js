import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const initialSql = await readFile(new URL('../migrations/0010_order_printing.sql', import.meta.url), 'utf8').catch(() => '')
const centralizedQueueSql = await readFile(new URL('../migrations/0014_centralized_print_queue.sql', import.meta.url), 'utf8').catch(() => '')

test('printing migration adds immutable ticket contact snapshots and station/job tables', () => {
  assert.match(initialSql, /ALTER TABLE orders ADD COLUMN client_phone_snapshot TEXT NOT NULL DEFAULT ''/)
  assert.match(initialSql, /ALTER TABLE orders ADD COLUMN client_address_snapshot TEXT NOT NULL DEFAULT ''/)
  assert.match(initialSql, /CREATE TABLE print_stations/)
  assert.match(initialSql, /default_copies INTEGER NOT NULL DEFAULT 2 CHECK \(default_copies IN \(1, 2\)\)/)
  assert.match(initialSql, /CREATE UNIQUE INDEX print_stations_one_primary_idx[\s\S]*WHERE is_primary = 1/)
  assert.match(initialSql, /CREATE TABLE print_jobs/)
  assert.match(initialSql, /status TEXT NOT NULL CHECK \(status IN \('pending', 'processing', 'printed', 'failed', 'requires_attention'\)\)/)
  assert.match(initialSql, /snapshot_json TEXT NOT NULL/)
  assert.match(initialSql, /CREATE UNIQUE INDEX print_jobs_one_auto_order_idx[\s\S]*WHERE type = 'order' AND trigger = 'automatic'/)
})

test('centralized queue migration preserves jobs while adding priority, audit, station health, and business copy settings', () => {
  assert.match(centralizedQueueSql, /CREATE TABLE print_jobs_next/i)
  assert.match(centralizedQueueSql, /priority INTEGER NOT NULL DEFAULT 0 CHECK \(priority IN \(0, 1\)\)/i)
  assert.match(centralizedQueueSql, /parent_job_id TEXT REFERENCES print_jobs_next\(id\) ON DELETE SET NULL/i)
  assert.match(centralizedQueueSql, /status TEXT NOT NULL CHECK \(status IN \([^)]*'requires_attention'[^)]*'discarded'[^)]*\)\)/i)
  assert.match(centralizedQueueSql, /copies_requested INTEGER NOT NULL CHECK \(copies_requested IN \(1, 2\)\)/i)
  assert.match(centralizedQueueSql, /discarded_at TEXT/i)
  assert.match(centralizedQueueSql, /attention_reason TEXT/i)
  assert.match(centralizedQueueSql, /action_actor_label TEXT/i)
  assert.match(centralizedQueueSql, /action_at TEXT/i)
  assert.match(centralizedQueueSql, /INSERT INTO print_jobs_next[\s\S]*SELECT[\s\S]*FROM print_jobs/i)
  assert.match(centralizedQueueSql, /ALTER TABLE print_jobs_next RENAME TO print_jobs/i)
  assert.match(centralizedQueueSql, /CREATE INDEX print_jobs_active_priority_idx\s+ON print_jobs \(business_id, priority DESC, available_at, created_at\)/i)
  assert.match(centralizedQueueSql, /ALTER TABLE print_stations ADD COLUMN qz_ready INTEGER NOT NULL DEFAULT 0 CHECK \(qz_ready IN \(0, 1\)\)/i)
  assert.match(centralizedQueueSql, /ALTER TABLE print_stations ADD COLUMN printer_ready INTEGER NOT NULL DEFAULT 0 CHECK \(printer_ready IN \(0, 1\)\)/i)
  assert.match(centralizedQueueSql, /ALTER TABLE print_stations ADD COLUMN last_ready_at TEXT/i)
  assert.match(centralizedQueueSql, /CREATE TABLE business_print_settings/i)
  assert.match(centralizedQueueSql, /business_id TEXT PRIMARY KEY REFERENCES businesses\(id\) ON DELETE CASCADE/i)
  assert.match(centralizedQueueSql, /default_copies INTEGER NOT NULL DEFAULT 2 CHECK \(default_copies IN \(1, 2\)\)/i)
  assert.match(centralizedQueueSql, /FROM print_stations[\s\S]*is_primary = 1/i)
  assert.match(centralizedQueueSql, /COALESCE\([\s\S]*2\)/i)
  assert.doesNotMatch(centralizedQueueSql, /DELETE FROM print_jobs|INSERT INTO print_jobs\s*\(/i)
})
