import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import {
  claimNextAutomaticPrintJob,
  createManualOrderPrintJob,
  heartbeatPrintStation,
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
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        name TEXT NOT NULL,
        platform TEXT NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0,
        auto_print_enabled INTEGER NOT NULL DEFAULT 0,
        default_copies INTEGER NOT NULL DEFAULT 2,
        last_seen_at TEXT,
        qz_ready INTEGER NOT NULL DEFAULT 0,
        printer_ready INTEGER NOT NULL DEFAULT 0,
        last_ready_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX print_stations_one_primary_idx ON print_stations (business_id) WHERE is_primary = 1;
      CREATE TABLE print_jobs (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        order_id TEXT,
        type TEXT NOT NULL,
        trigger TEXT NOT NULL,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        parent_job_id TEXT,
        copies_requested INTEGER NOT NULL,
        copies_printed INTEGER NOT NULL DEFAULT 0,
        station_id TEXT,
        snapshot_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        available_at TEXT,
        processing_started_at TEXT,
        processed_at TEXT,
        discarded_at TEXT,
        attention_reason TEXT,
        action_actor_label TEXT,
        action_at TEXT,
        last_error_code TEXT,
        last_error_message TEXT
      );
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
const now = new Date('2026-09-08T20:30:00.000Z')

test('primary QZ station consumes a manual queued job even when automatic printing is disabled', async () => {
  const db = new D1Sqlite()
  db.sqlite.exec(`
    INSERT INTO businesses (id) VALUES ('${businessId}');
    INSERT INTO orders (id, business_id, status) VALUES ('order-manual', '${businessId}', 'Em preparo');
  `)

  await upsertPrintStation(db, businessId, {
    id: 'kitchen-qz',
    name: 'Cozinha PC',
    platform: 'windows',
    autoPrintEnabled: false,
    defaultCopies: 2,
  }, now)
  await setPrimaryPrintStation(db, businessId, 'kitchen-qz', now)
  await heartbeatPrintStation(db, businessId, 'kitchen-qz', { qzReady: true, printerReady: true }, now)

  const manual = await createManualOrderPrintJob(db, businessId, {
    id: 'manual-job',
    orderId: 'order-manual',
    copies: 1,
    document: { version: 1, type: 'order', order: { id: 'order-manual', number: '0001' } },
  }, now)

  const claimed = await claimNextAutomaticPrintJob(db, businessId, 'kitchen-qz', now)
  assert.equal(claimed.id, manual.id)
  assert.equal(claimed.trigger, 'manual')
  assert.equal(claimed.status, 'processing')
  assert.equal(claimed.stationId, 'kitchen-qz')
})
