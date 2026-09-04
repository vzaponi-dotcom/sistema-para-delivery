import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const sql = await readFile(new URL('../migrations/0010_order_printing.sql', import.meta.url), 'utf8').catch(() => '')

test('printing migration adds immutable ticket contact snapshots and station/job tables', () => {
  assert.match(sql, /ALTER TABLE orders ADD COLUMN client_phone_snapshot TEXT NOT NULL DEFAULT ''/)
  assert.match(sql, /ALTER TABLE orders ADD COLUMN client_address_snapshot TEXT NOT NULL DEFAULT ''/)
  assert.match(sql, /CREATE TABLE print_stations/)
  assert.match(sql, /default_copies INTEGER NOT NULL DEFAULT 2 CHECK \(default_copies IN \(1, 2\)\)/)
  assert.match(sql, /CREATE UNIQUE INDEX print_stations_one_primary_idx[\s\S]*WHERE is_primary = 1/)
  assert.match(sql, /CREATE TABLE print_jobs/)
  assert.match(sql, /status TEXT NOT NULL CHECK \(status IN \('pending', 'processing', 'printed', 'failed', 'requires_attention'\)\)/)
  assert.match(sql, /snapshot_json TEXT NOT NULL/)
  assert.match(sql, /CREATE UNIQUE INDEX print_jobs_one_auto_order_idx[\s\S]*WHERE type = 'order' AND trigger = 'automatic'/)
})
