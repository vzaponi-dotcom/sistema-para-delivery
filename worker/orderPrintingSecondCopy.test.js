import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import {
  claimPrintJob,
  createManualOrderPrintJob,
  markPrintJobFailed,
  markPrintJobPrinted,
  prepareAutomaticPrintJobStatement,
  retryPrintJob,
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
const stationId = 'kitchen-qz'
const now = new Date('2026-09-08T20:45:00.000Z')
const document = { version: 1, type: 'order', order: { id: 'order-1', number: '0001' } }

const makeDb = () => {
  const db = new D1Sqlite()
  const at = now.toISOString()
  db.sqlite.prepare('INSERT INTO businesses (id) VALUES (?)').run(businessId)
  db.sqlite.prepare("INSERT INTO orders (id, business_id, status) VALUES (?, ?, 'Em preparo')").run('order-1', businessId)
  db.sqlite.prepare(`INSERT INTO print_stations (
    id, business_id, name, platform, is_primary, auto_print_enabled, default_copies,
    last_seen_at, qz_ready, printer_ready, last_ready_at, created_at, updated_at
  ) VALUES (?, ?, 'Cozinha PC', 'windows', 1, 1, 2, ?, 1, 1, ?, ?, ?)`)
    .run(stationId, businessId, at, at, at, at)
  return db
}

test('first successful copy of a two-copy job enters waiting_second_copy and only the explicit second claim completes it', async () => {
  const db = makeDb()
  const created = await createManualOrderPrintJob(db, businessId, {
    id: 'two-copy-job', orderId: 'order-1', copies: 2, document,
  }, now)

  await claimPrintJob(db, businessId, created.id, stationId, now)
  const first = await markPrintJobPrinted(db, businessId, created.id, stationId, 1, now)
  assert.equal(first.status, 'waiting_second_copy')
  assert.equal(first.copiesPrinted, 1)

  const secondClaim = await claimPrintJob(db, businessId, created.id, stationId, now)
  assert.equal(secondClaim.status, 'processing')
  assert.equal(secondClaim.copiesPrinted, 1)

  const completed = await markPrintJobPrinted(db, businessId, created.id, stationId, 2, now)
  assert.equal(completed.status, 'printed')
  assert.equal(completed.copiesPrinted, 2)
})

test('retry after a failed second-copy attempt restores waiting_second_copy without erasing first-copy progress', async () => {
  const db = makeDb()
  const created = await createManualOrderPrintJob(db, businessId, {
    id: 'second-copy-retry', orderId: 'order-1', copies: 2, document,
  }, now)

  await claimPrintJob(db, businessId, created.id, stationId, now)
  await markPrintJobPrinted(db, businessId, created.id, stationId, 1, now)
  await claimPrintJob(db, businessId, created.id, stationId, now)
  await markPrintJobFailed(db, businessId, created.id, stationId, {
    code: 'PRINTER_OFFLINE', message: 'Impressora indisponível', uncertain: false,
  }, now)

  const retried = await retryPrintJob(db, businessId, created.id, now)
  assert.equal(retried.status, 'waiting_second_copy')
  assert.equal(retried.copiesPrinted, 1)
})

test('one-copy jobs complete directly and never enter waiting_second_copy', async () => {
  const db = makeDb()
  const created = await createManualOrderPrintJob(db, businessId, {
    id: 'one-copy-job', orderId: 'order-1', copies: 1, document,
  }, now)
  await claimPrintJob(db, businessId, created.id, stationId, now)
  const completed = await markPrintJobPrinted(db, businessId, created.id, stationId, 1, now)
  assert.equal(completed.status, 'printed')
  assert.equal(completed.copiesPrinted, 1)
})

test('automatic table-style one-copy jobs complete directly after their only physical pass', async () => {
  const db = makeDb()
  const statement = prepareAutomaticPrintJobStatement(db, businessId, {
    id: 'table-auto-job', orderId: 'order-1', copies: 1, document, createdAt: now,
  })
  await db.batch([statement])
  await claimPrintJob(db, businessId, 'table-auto-job', stationId, now)
  const completed = await markPrintJobPrinted(db, businessId, 'table-auto-job', stationId, 1, now)
  assert.equal(completed.status, 'printed')
  assert.equal(completed.copiesRequested, 1)
})
