import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import {
  claimNextAutomaticPrintJob,
  claimPrintJob,
  createManualOrderPrintJob,
  heartbeatPrintStation,
  prepareAutomaticPrintJobStatement,
  setPrimaryPrintStation,
  upsertPrintStation,
} from './orderPrintingRepository.js'

class D1Sqlite {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:')
    this.sqlite.exec(`
      CREATE TABLE businesses (id TEXT PRIMARY KEY);
      CREATE TABLE orders (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Em preparo');
      CREATE TABLE print_stations (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL, platform TEXT NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0, auto_print_enabled INTEGER NOT NULL DEFAULT 0,
        default_copies INTEGER NOT NULL DEFAULT 2, last_seen_at TEXT,
        qz_ready INTEGER NOT NULL DEFAULT 0, printer_ready INTEGER NOT NULL DEFAULT 0, last_ready_at TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX print_stations_one_primary_idx ON print_stations (business_id) WHERE is_primary = 1;
      CREATE TABLE print_jobs (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT, type TEXT NOT NULL, trigger TEXT NOT NULL,
        status TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0, parent_job_id TEXT,
        copies_requested INTEGER NOT NULL, copies_printed INTEGER NOT NULL DEFAULT 0,
        station_id TEXT, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL, available_at TEXT,
        processing_started_at TEXT, processed_at TEXT, discarded_at TEXT, attention_reason TEXT,
        action_actor_label TEXT, action_at TEXT, second_copy_requested_at TEXT, second_copy_skipped_at TEXT, last_error_code TEXT, last_error_message TEXT
      );
      CREATE UNIQUE INDEX print_jobs_one_auto_order_idx ON print_jobs (business_id, order_id)
        WHERE type = 'order' AND trigger = 'automatic';
      INSERT INTO businesses (id) VALUES ('amor-e-sabor');
      INSERT INTO orders (id, business_id, status) VALUES ('o1', 'amor-e-sabor', 'Em preparo');
    `)
  }

  prepare(sql) {
    const database = this.sqlite
    return {
      bind(...values) {
        return {
          async first() { return database.prepare(sql).get(...values) ?? null },
          async all() { return { results: database.prepare(sql).all(...values) } },
          async run() {
            const result = database.prepare(sql).run(...values)
            return { success: true, meta: { changes: Number(result.changes || 0) } }
          },
        }
      },
    }
  }

  async batch(statements) {
    const results = []
    for (const statement of statements) results.push(await statement.run())
    return results
  }
}

const businessId = 'amor-e-sabor'
const now = new Date('2026-09-08T20:00:00.000Z')
const document = { version: 1, type: 'order', order: { id: 'o1', number: '0001' } }

const addStation = (db, id, platform, autoPrintEnabled = true) => upsertPrintStation(db, businessId, {
  id,
  name: id,
  platform,
  autoPrintEnabled,
  defaultCopies: 2,
}, now)

const addAutomaticJob = async (db, id = 'auto-job') => {
  await db.batch([prepareAutomaticPrintJobStatement(db, businessId, {
    id,
    orderId: 'o1',
    copies: 2,
    document,
    createdAt: now,
    availableAt: now,
  })])
}

test('an Android station cannot claim automatic work even when legacy data marks it primary and automatic', async () => {
  const db = new D1Sqlite()
  await addStation(db, 'legacy-android', 'android', true)
  await setPrimaryPrintStation(db, businessId, 'legacy-android', now)
  await addAutomaticJob(db)

  await assert.rejects(
    () => claimNextAutomaticPrintJob(db, businessId, 'legacy-android', now),
    (error) => error.code === 'PRINT_STATION_NOT_QZ_EXECUTOR',
  )
})

test('the primary Windows automatic station can claim the next automatic job', async () => {
  const db = new D1Sqlite()
  await addStation(db, 'kitchen', 'windows', true)
  await setPrimaryPrintStation(db, businessId, 'kitchen', now)
  await heartbeatPrintStation(db, businessId, 'kitchen', { qzReady: true, printerReady: true }, now)
  await addAutomaticJob(db)

  const claimed = await claimNextAutomaticPrintJob(db, businessId, 'kitchen', now)
  assert.equal(claimed.id, 'auto-job')
  assert.equal(claimed.stationId, 'kitchen')
  assert.equal(claimed.status, 'processing')
})

test('manual physical execution also rejects a non-primary station', async () => {
  const db = new D1Sqlite()
  await addStation(db, 'kitchen', 'windows', true)
  await addStation(db, 'other-windows', 'windows', true)
  await setPrimaryPrintStation(db, businessId, 'kitchen', now)
  const job = await createManualOrderPrintJob(db, businessId, {
    id: 'manual-job', orderId: 'o1', copies: 1, document,
  }, now)

  await assert.rejects(
    () => claimPrintJob(db, businessId, job.id, 'other-windows', now),
    (error) => error.code === 'PRINT_STATION_NOT_PRIMARY',
  )

  const claimed = await claimPrintJob(db, businessId, job.id, 'kitchen', now)
  assert.equal(claimed.stationId, 'kitchen')
})
