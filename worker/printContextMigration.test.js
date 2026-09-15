import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

const migrations = new URL('../migrations/', import.meta.url)
const migration = new URL('../migrations/0025_print_context_copies.sql', import.meta.url)
const BUSINESS = 'amor-e-sabor'
const EARLY = '2026-01-01T10:00:00.000Z'
const LATE = '2026-01-02T11:12:13.000Z'

const rows = (sqlite, sql, ...values) => sqlite.prepare(sql).all(...values).map((row) => ({ ...row }))

function insert(sqlite, table, data) {
  const columns = Object.keys(data)
  sqlite.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
    .run(...Object.values(data))
}

function applyThrough(sqlite, lastMigration) {
  const files = readdirSync(migrations)
    .filter((name) => name.endsWith('.sql') && Number(name.slice(0, 4)) <= lastMigration)
    .sort()
  for (const file of files) sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'))
  sqlite.exec('PRAGMA foreign_keys = ON')
}

function createLegacyDatabase() {
  const sqlite = new DatabaseSync(':memory:')
  applyThrough(sqlite, 24)
  return sqlite
}

function jobFixture(index, status) {
  return {
    id: `job-${status}`,
    business_id: BUSINESS,
    order_id: `order-${status}`,
    table_tab_id: null,
    type: 'order',
    trigger: index === 0 ? 'automatic' : 'manual',
    status,
    priority: index % 2,
    parent_job_id: index === 1 ? 'job-pending' : null,
    copies_requested: status === 'awaiting_second_copy' ? 2 : 1,
    copies_printed: status === 'awaiting_second_copy' ? 1 : status === 'printed' ? 1 : 0,
    station_id: 'station-primary',
    snapshot_json: JSON.stringify({ status, document: `snapshot-${index}` }),
    created_at: `${EARLY.slice(0, 11)}${String(10 + index).padStart(2, '0')}:00:00.000Z`,
    available_at: EARLY,
    processing_started_at: index > 0 ? LATE : null,
    processed_at: ['printed', 'failed', 'discarded'].includes(status) ? LATE : null,
    discarded_at: status === 'discarded' ? LATE : null,
    attention_reason: status === 'requires_attention' ? 'paper-out' : null,
    action_actor_label: index % 2 ? 'Operador sintético' : null,
    action_at: index % 2 ? LATE : null,
    last_error_code: ['failed', 'requires_attention'].includes(status) ? 'SYNTHETIC_ERROR' : null,
    last_error_message: ['failed', 'requires_attention'].includes(status) ? 'Synthetic failure' : null,
    second_copy_prompted_at: status === 'awaiting_second_copy' ? LATE : null,
    second_copy_requested_at: status === 'awaiting_second_copy' ? LATE : null,
    second_copy_skipped_at: status === 'discarded' ? LATE : null,
  }
}

function seedPrintHistory(sqlite) {
  const statuses = ['pending', 'processing', 'awaiting_confirmation', 'awaiting_second_copy', 'printed', 'failed', 'requires_attention', 'discarded']
  for (const [index, status] of statuses.entries()) {
    insert(sqlite, 'orders', {
      id: `order-${status}`,
      business_id: BUSINESS,
      client_name_snapshot: `Cliente ${status}`,
      type: 'Entrega',
      order_date: '2026-01-01',
      status: 'Finalizado',
      subtotal_cents: 1000 + index,
      total_cents: 1000 + index,
      delivery_fee_cents: 0,
      created_at: EARLY,
    })
  }
  insert(sqlite, 'table_tabs', {
    id: 'tab-17', business_id: BUSINESS, table_identifier: 'Mesa 17', status: 'closed',
    opened_at: EARLY, closed_at: LATE, created_at: EARLY, updated_at: LATE, tab_number: 17,
  })
  insert(sqlite, 'print_stations', {
    id: 'station-primary', business_id: BUSINESS, name: 'Caixa sintético', platform: 'windows',
    is_primary: 1, auto_print_enabled: 1, default_copies: 2, last_seen_at: LATE,
    created_at: EARLY, updated_at: LATE, qz_ready: 1, printer_ready: 1, last_ready_at: LATE,
    physical_state: 'ready', physical_status_text: 'Ready', physical_status_code: 200,
    physical_status_at: LATE, last_offline_at: EARLY, recovery_state: 'active', config_revision: 4,
  })
  insert(sqlite, 'print_stations', {
    id: 'station-secondary', business_id: BUSINESS, name: 'Cozinha sintética', platform: 'windows',
    is_primary: 0, auto_print_enabled: 0, default_copies: 1, created_at: EARLY, updated_at: LATE,
    qz_ready: 0, printer_ready: 0, physical_state: 'printer_offline', recovery_state: 'deferred', config_revision: 2,
  })
  sqlite.prepare('UPDATE business_print_topology_settings SET primary_station_id = ?, revision = 3 WHERE business_id = ?')
    .run('station-primary', BUSINESS)

  statuses.forEach((status, index) => insert(sqlite, 'print_jobs', jobFixture(index, status)))
  insert(sqlite, 'print_jobs', {
    ...jobFixture(8, 'printed'), id: 'job-table-tab', order_id: null, table_tab_id: 'tab-17',
    type: 'table-tab', trigger: 'manual', copies_requested: 1, copies_printed: 1,
    snapshot_json: JSON.stringify({ type: 'table-tab', tableTab: { id: 'tab-17', number: 17 } }),
  })
  insert(sqlite, 'print_jobs', {
    ...jobFixture(9, 'printed'), id: 'job-test', order_id: null, table_tab_id: null,
    type: 'test', trigger: 'manual', copies_requested: 1, copies_printed: 1,
    snapshot_json: JSON.stringify({ type: 'test' }),
  })

  const attemptStatuses = ['prepared', 'submitting', 'spooling', 'printing', 'complete', 'failed', 'unknown']
  attemptStatuses.forEach((status, index) => insert(sqlite, 'print_job_attempts', {
    id: `attempt-${status}`,
    business_id: BUSINESS,
    job_id: jobFixture(index, statuses[index]).id,
    copy_number: index === 4 ? 2 : 1,
    attempt_number: index + 1,
    station_id: index === 6 ? 'station-secondary' : 'station-primary',
    spool_job_name: `synthetic-spool-${status}`,
    spool_job_id: 700 + index,
    status,
    submission_started_at: index > 0 ? EARLY : null,
    submitted_at: index > 1 ? EARLY : null,
    last_event_at: index > 2 ? LATE : null,
    completed_at: status === 'complete' ? LATE : null,
    resolution: status === 'unknown' ? 'manual_not_printed' : null,
    resolution_actor_label: status === 'unknown' ? 'Operador sintético' : null,
    resolved_at: status === 'unknown' ? LATE : null,
    last_error_code: status === 'failed' ? 'SPOOL_FAILED' : null,
    last_error_message: status === 'failed' ? 'Synthetic spool failure' : null,
    created_at: EARLY,
    updated_at: LATE,
  }))
  sqlite.prepare('UPDATE print_stations SET recovery_job_id = ? WHERE id = ?')
    .run('job-awaiting_second_copy', 'station-primary')
}

export function snapshotPrintTables(sqlite) {
  return Object.fromEntries(['print_jobs', 'print_job_attempts', 'print_stations'].map((table) => [
    table, rows(sqlite, `SELECT * FROM ${table} ORDER BY id`),
  ]))
}

export function applyPrintContextMigration(sqlite) {
  if (!existsSync(migration)) return
  sqlite.exec(readFileSync(migration, 'utf8'))
}

export function insertTwoCopyTableTabFixture(sqlite, id = 'job-table-tab-two-copies') {
  insert(sqlite, 'print_jobs', {
    ...jobFixture(10, 'pending'), id, order_id: null, table_tab_id: 'tab-17', type: 'table-tab',
    trigger: 'manual', copies_requested: 2, copies_printed: 0,
    snapshot_json: JSON.stringify({ type: 'table-tab', tableTab: { id: 'tab-17', number: 17 }, copies: 2 }),
  })
}

function printSchema(sqlite) {
  return {
    columns: Object.fromEntries(['print_jobs', 'print_job_attempts', 'print_stations']
      .map((table) => [table, rows(sqlite, `PRAGMA table_info(${table})`)])),
    foreignKeys: Object.fromEntries(['print_jobs', 'print_job_attempts', 'print_stations']
      .map((table) => [table, rows(sqlite, `PRAGMA foreign_key_list(${table})`)])),
    indexes: rows(sqlite, `SELECT name, tbl_name, sql FROM sqlite_schema
      WHERE type = 'index' AND tbl_name IN ('print_jobs', 'print_job_attempts', 'print_stations') AND sql IS NOT NULL ORDER BY name`),
    triggers: rows(sqlite, `SELECT name, tbl_name, sql FROM sqlite_schema
      WHERE type = 'trigger' AND tbl_name IN ('print_jobs', 'print_job_attempts', 'print_stations') ORDER BY name`),
    attemptsSql: rows(sqlite, "SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'print_job_attempts'")[0].sql,
    stationsSql: rows(sqlite, "SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'print_stations'")[0].sql,
  }
}

const normalizedSql = (sql) => sql.replaceAll('"', '').replace(/\s+/g, ' ').trim()

function invalidPrintJob(sqlite, overrides) {
  assert.throws(() => insert(sqlite, 'print_jobs', { ...jobFixture(20, 'pending'), id: `invalid-${crypto.randomUUID()}`, ...overrides }), /constraint/i)
}

test('pre-0025 schema rejects a two-copy manual table-tab summary', (t) => {
  const sqlite = createLegacyDatabase()
  t.after(() => sqlite.close())
  seedPrintHistory(sqlite)
  assert.throws(() => insertTwoCopyTableTabFixture(sqlite), /constraint/i)
})

test('0025 preserves complete print history, relationships and final schema objects', (t) => {
  const sqlite = createLegacyDatabase()
  t.after(() => sqlite.close())
  seedPrintHistory(sqlite)
  const dataBefore = snapshotPrintTables(sqlite)
  const schemaBefore = printSchema(sqlite)

  applyPrintContextMigration(sqlite)

  assert.deepEqual(snapshotPrintTables(sqlite), dataBefore)
  assert.deepEqual(rows(sqlite, 'PRAGMA foreign_key_check'), [])
  const schemaAfter = printSchema(sqlite)
  assert.deepEqual(schemaAfter.columns, schemaBefore.columns)
  assert.deepEqual(schemaAfter.foreignKeys, schemaBefore.foreignKeys)
  assert.deepEqual(schemaAfter.indexes, schemaBefore.indexes)
  assert.deepEqual(schemaAfter.triggers, schemaBefore.triggers)
  assert.equal(normalizedSql(schemaAfter.attemptsSql), normalizedSql(schemaBefore.attemptsSql))
  assert.equal(schemaAfter.stationsSql, schemaBefore.stationsSql)
  assert.doesNotThrow(() => insertTwoCopyTableTabFixture(sqlite))
})

test('0025 keeps every other print job identity constraint', (t) => {
  const sqlite = createLegacyDatabase()
  t.after(() => sqlite.close())
  seedPrintHistory(sqlite)
  applyPrintContextMigration(sqlite)

  invalidPrintJob(sqlite, { order_id: null, type: 'order' })
  invalidPrintJob(sqlite, { table_tab_id: 'tab-17', type: 'order' })
  invalidPrintJob(sqlite, { order_id: null, table_tab_id: null, type: 'table-tab', trigger: 'manual' })
  invalidPrintJob(sqlite, { order_id: null, table_tab_id: 'tab-17', type: 'table-tab', trigger: 'automatic' })
  invalidPrintJob(sqlite, { order_id: 'order-pending', table_tab_id: 'tab-17', type: 'table-tab', trigger: 'manual' })
  invalidPrintJob(sqlite, { order_id: 'order-pending', table_tab_id: null, type: 'test' })
  invalidPrintJob(sqlite, { order_id: null, table_tab_id: 'tab-17', type: 'test' })
  invalidPrintJob(sqlite, { copies_requested: 0 })
  invalidPrintJob(sqlite, { copies_requested: 3 })
})

test('a clean installation through the complete migration sequence accepts two-copy table-tab summaries', (t) => {
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  applyThrough(sqlite, 25)
  seedPrintHistory(sqlite)
  assert.doesNotThrow(() => insertTwoCopyTableTabFixture(sqlite, 'clean-table-tab-two-copies'))
  assert.deepEqual(rows(sqlite, 'PRAGMA foreign_key_check'), [])
})
