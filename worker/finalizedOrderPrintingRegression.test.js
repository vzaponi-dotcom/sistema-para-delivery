import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import {
  claimNextAutomaticPrintJob,
  claimPrintJob,
  createManualOrderPrintJob,
  prepareAutomaticPrintJobStatement,
  setPrimaryPrintStation,
  upsertPrintStation,
} from './orderPrintingRepository.js'

class D1Sqlite {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:')
    this.sqlite.exec(`
      CREATE TABLE orders (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, status TEXT NOT NULL);
      CREATE TABLE print_stations (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL, platform TEXT NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0, auto_print_enabled INTEGER NOT NULL DEFAULT 0,
        default_copies INTEGER NOT NULL DEFAULT 2, last_seen_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX print_stations_one_primary_idx ON print_stations (business_id) WHERE is_primary = 1;
      CREATE TABLE print_jobs (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT, type TEXT NOT NULL, trigger TEXT NOT NULL,
        status TEXT NOT NULL, copies_requested INTEGER NOT NULL, copies_printed INTEGER NOT NULL DEFAULT 0,
        station_id TEXT, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL, available_at TEXT NOT NULL,
        processing_started_at TEXT, processed_at TEXT, last_error_code TEXT, last_error_message TEXT
      );
      CREATE UNIQUE INDEX print_jobs_one_auto_order_idx ON print_jobs (business_id, order_id)
        WHERE type = 'order' AND trigger = 'automatic';
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

  exec(sql) { this.sqlite.exec(sql) }
}

const businessId = 'amor-e-sabor'
const now = new Date('2026-09-08T12:00:00.000Z')
const document = { version: 1, type: 'order', order: { id: 'order-final', number: '0001' } }

const setup = async () => {
  const db = new D1Sqlite()
  db.exec(`INSERT INTO orders (id, business_id, status) VALUES ('order-final', '${businessId}', 'Finalizado')`)
  await upsertPrintStation(db, businessId, {
    id: 'kitchen', name: 'Cozinha', platform: 'windows', autoPrintEnabled: true, defaultCopies: 2,
  }, now)
  await setPrimaryPrintStation(db, businessId, 'kitchen', now)
  return db
}

test('automatic jobs from finalized orders are not claimed by the kitchen station', async () => {
  const db = await setup()
  await db.batch([prepareAutomaticPrintJobStatement(db, businessId, {
    id: 'auto-final', orderId: 'order-final', copies: 2, document, createdAt: now, availableAt: now,
  })])

  assert.equal(await claimNextAutomaticPrintJob(db, businessId, 'kitchen', now), null)
})

test('manual print remains claimable for a finalized order', async () => {
  const db = await setup()
  const manual = await createManualOrderPrintJob(db, businessId, {
    id: 'manual-final', orderId: 'order-final', copies: 1, document,
  }, now)

  const claimed = await claimPrintJob(db, businessId, manual.id, 'kitchen', now)
  assert.equal(claimed.id, 'manual-final')
  assert.equal(claimed.trigger, 'manual')
  assert.equal(claimed.status, 'processing')
})
