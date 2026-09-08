import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'

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

const migrationsUrl = new URL('../migrations/', import.meta.url)

async function applyMigrationsBeforeCentralizedQueue(db) {
  const migrationFiles = (await readdir(migrationsUrl)).filter((file) => file < '0014_centralized_print_queue.sql').sort()
  for (const file of migrationFiles) db.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'))
}

async function applyAllMigrations(db) {
  const migrationFiles = (await readdir(migrationsUrl)).filter((file) => file.endsWith('.sql')).sort()
  for (const file of migrationFiles) db.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'))
}

function rows(statement) {
  return statement.all().map((row) => ({ ...row }))
}

test('centralized queue migration preserves historical jobs and deterministically seeds central copy settings', async () => {
  const db = new DatabaseSync(':memory:')
  await applyMigrationsBeforeCentralizedQueue(db)

  const createdAt = '2026-09-08T12:00:00.000Z'
  const insertBusiness = db.prepare('INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
  insertBusiness.run('business-one-copy', 'one-copy', 'One copy', createdAt, createdAt)
  insertBusiness.run('business-two-copies', 'two-copies', 'Two copies', createdAt, createdAt)
  insertBusiness.run('business-fallback', 'fallback', 'Fallback', createdAt, createdAt)

  const insertStation = db.prepare('INSERT INTO print_stations (id, business_id, name, platform, is_primary, auto_print_enabled, default_copies, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  insertStation.run('station-one-copy', 'business-one-copy', 'Kitchen one', 'windows', 1, 1, 1, createdAt, createdAt, createdAt)
  insertStation.run('station-two-copies', 'business-two-copies', 'Kitchen two', 'windows', 1, 1, 2, createdAt, createdAt, createdAt)
  insertStation.run('station-legacy', 'business-fallback', 'Legacy', 'android', 0, 0, 1, createdAt, createdAt, createdAt)

  const insertJob = db.prepare('INSERT INTO print_jobs (id, business_id, type, trigger, status, copies_requested, copies_printed, station_id, snapshot_json, created_at, available_at, processing_started_at, processed_at, last_error_code, last_error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  insertJob.run('job-origin', 'business-one-copy', 'test', 'manual', 'printed', 2, 1, 'station-one-copy', '{"ticket":"origin"}', createdAt, createdAt, createdAt, createdAt, 'OLD_PRINT', 'old print result')
  insertJob.run('job-pending', 'business-one-copy', 'test', 'automatic', 'pending', 1, 0, 'station-one-copy', '{"ticket":"pending"}', createdAt, createdAt, null, null, null, null)
  insertJob.run('job-two-copies', 'business-two-copies', 'test', 'manual', 'requires_attention', 2, 0, 'station-two-copies', '{"ticket":"two"}', createdAt, createdAt, null, null, 'QZ_OFFLINE', 'QZ unavailable')
  insertJob.run('job-fallback', 'business-fallback', 'test', 'manual', 'failed', 1, 0, 'station-legacy', '{"ticket":"fallback"}', createdAt, createdAt, null, null, 'LEGACY', 'legacy error')

  const historicalJobCount = db.prepare('SELECT count(*) AS count FROM print_jobs').get().count
  db.exec(centralizedQueueSql)

  assert.equal(db.prepare('SELECT count(*) AS count FROM print_jobs').get().count, historicalJobCount)
  assert.deepEqual(rows(db.prepare('SELECT id, business_id, type, trigger, status, copies_requested, copies_printed, station_id, snapshot_json, created_at, available_at, processing_started_at, processed_at, last_error_code, last_error_message, priority, parent_job_id, discarded_at, attention_reason, action_actor_label, action_at FROM print_jobs ORDER BY id')), [
    { id: 'job-fallback', business_id: 'business-fallback', type: 'test', trigger: 'manual', status: 'failed', copies_requested: 1, copies_printed: 0, station_id: 'station-legacy', snapshot_json: '{"ticket":"fallback"}', created_at: createdAt, available_at: createdAt, processing_started_at: null, processed_at: null, last_error_code: 'LEGACY', last_error_message: 'legacy error', priority: 0, parent_job_id: null, discarded_at: null, attention_reason: null, action_actor_label: null, action_at: null },
    { id: 'job-origin', business_id: 'business-one-copy', type: 'test', trigger: 'manual', status: 'printed', copies_requested: 2, copies_printed: 1, station_id: 'station-one-copy', snapshot_json: '{"ticket":"origin"}', created_at: createdAt, available_at: createdAt, processing_started_at: createdAt, processed_at: createdAt, last_error_code: 'OLD_PRINT', last_error_message: 'old print result', priority: 0, parent_job_id: null, discarded_at: null, attention_reason: null, action_actor_label: null, action_at: null },
    { id: 'job-pending', business_id: 'business-one-copy', type: 'test', trigger: 'automatic', status: 'pending', copies_requested: 1, copies_printed: 0, station_id: 'station-one-copy', snapshot_json: '{"ticket":"pending"}', created_at: createdAt, available_at: createdAt, processing_started_at: null, processed_at: null, last_error_code: null, last_error_message: null, priority: 0, parent_job_id: null, discarded_at: null, attention_reason: null, action_actor_label: null, action_at: null },
    { id: 'job-two-copies', business_id: 'business-two-copies', type: 'test', trigger: 'manual', status: 'requires_attention', copies_requested: 2, copies_printed: 0, station_id: 'station-two-copies', snapshot_json: '{"ticket":"two"}', created_at: createdAt, available_at: createdAt, processing_started_at: null, processed_at: null, last_error_code: 'QZ_OFFLINE', last_error_message: 'QZ unavailable', priority: 0, parent_job_id: null, discarded_at: null, attention_reason: null, action_actor_label: null, action_at: null },
  ])
  assert.deepEqual(rows(db.prepare("SELECT business_id, default_copies FROM business_print_settings WHERE business_id IN ('business-fallback', 'business-one-copy', 'business-two-copies') ORDER BY business_id")), [
    { business_id: 'business-fallback', default_copies: 2 },
    { business_id: 'business-one-copy', default_copies: 1 },
    { business_id: 'business-two-copies', default_copies: 2 },
  ])
  assert.deepEqual(rows(db.prepare('SELECT id, last_seen_at, qz_ready, printer_ready, last_ready_at FROM print_stations ORDER BY id')), [
    { id: 'station-legacy', last_seen_at: createdAt, qz_ready: 0, printer_ready: 0, last_ready_at: null },
    { id: 'station-one-copy', last_seen_at: createdAt, qz_ready: 0, printer_ready: 0, last_ready_at: null },
    { id: 'station-two-copies', last_seen_at: createdAt, qz_ready: 0, printer_ready: 0, last_ready_at: null },
  ])

  db.prepare("UPDATE print_jobs SET status = 'discarded', priority = 1, parent_job_id = ?, discarded_at = ?, attention_reason = ?, action_actor_label = ?, action_at = ? WHERE id = ?")
    .run('job-origin', '2026-09-08T12:05:00.000Z', 'operator decision', 'Kitchen PC', '2026-09-08T12:05:00.000Z', 'job-pending')
  assert.deepEqual({ ...db.prepare('SELECT status, priority, parent_job_id, discarded_at, attention_reason, action_actor_label, action_at FROM print_jobs WHERE id = ?').get('job-pending') }, {
    status: 'discarded',
    priority: 1,
    parent_job_id: 'job-origin',
    discarded_at: '2026-09-08T12:05:00.000Z',
    attention_reason: 'operator decision',
    action_actor_label: 'Kitchen PC',
    action_at: '2026-09-08T12:05:00.000Z',
  })
})

test('print jobs schema accepts awaiting_second_copy', async () => {
  const db = new DatabaseSync(':memory:')
  await applyAllMigrations(db)
  const createdAt = '2026-09-08T12:00:00.000Z'
  db.prepare('INSERT INTO businesses (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run('business-awaiting-second-copy', 'awaiting-second-copy', 'Awaiting second copy', createdAt, createdAt)

  db.prepare(`INSERT INTO print_jobs (
    id, business_id, type, trigger, status, copies_requested, copies_printed, snapshot_json, created_at
  ) VALUES (?, ?, 'test', 'manual', 'awaiting_second_copy', 2, 1, '{}', ?)`)
    .run('job-awaiting-second-copy', 'business-awaiting-second-copy', createdAt)

  assert.equal(db.prepare('SELECT status FROM print_jobs WHERE id = ?').get('job-awaiting-second-copy').status, 'awaiting_second_copy')
})

test('print jobs schema persists second-copy prompt acknowledgments', async () => {
  const db = new DatabaseSync(':memory:')
  await applyAllMigrations(db)

  assert.equal(
    db.prepare("SELECT count(*) AS count FROM pragma_table_info('print_jobs') WHERE name = 'second_copy_prompted_at'").get().count,
    1,
  )
})
