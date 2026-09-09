import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import * as printingRepository from './orderPrintingRepository.js'

class D1Sqlite {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:')
    this.sqlite.exec(`
      PRAGMA foreign_keys = ON;
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
    this.sqlite.exec('BEGIN')
    try {
      const results = []
      for (const statement of statements) results.push(await statement.run())
      this.sqlite.exec('COMMIT')
      return results
    } catch (error) {
      this.sqlite.exec('ROLLBACK')
      throw error
    }
  }

  exec(sql) { this.sqlite.exec(sql) }
}

const businessId = 'amor-e-sabor'
const baseNow = new Date('2026-09-08T18:00:00.000Z')
const documentFor = (orderId) => ({ version: 1, type: 'order', order: { id: orderId, number: orderId } })

const makeDb = () => {
  const db = new D1Sqlite()
  db.exec(`
    INSERT INTO businesses (id) VALUES ('${businessId}');
    INSERT INTO orders (id, business_id) VALUES ('o1', '${businessId}'), ('o2', '${businessId}'), ('o3', '${businessId}'), ('o4', '${businessId}');
  `)
  return db
}

const addAutomaticJob = async (db, { id, orderId, createdAt }) => {
  const statement = printingRepository.prepareAutomaticPrintJobStatement(db, businessId, {
    id,
    orderId,
    copies: 1,
    document: documentFor(orderId),
    createdAt: createdAt.toISOString(),
    availableAt: createdAt.toISOString(),
  })
  await db.batch([statement])
  return printingRepository.loadPrintJob(db, businessId, id)
}

test('prioritize is central, keeps an offline queued job pending, and makes it the next automatic claim', async () => {
  assert.equal(typeof printingRepository.prioritizePrintJob, 'function')
  const db = makeDb()
  await addAutomaticJob(db, { id: 'older-job', orderId: 'o1', createdAt: baseNow })
  await addAutomaticJob(db, { id: 'urgent-job', orderId: 'o2', createdAt: new Date(baseNow.getTime() + 1000) })

  const prioritized = await printingRepository.prioritizePrintJob(db, businessId, 'urgent-job', baseNow)
  assert.equal(prioritized.status, 'pending')
  assert.equal(prioritized.priority, 1)
  assert.equal(prioritized.stationId, null)
  assert.equal(prioritized.actionAt, baseNow.toISOString())
  assert.equal(prioritized.actionActorLabel, 'Sistema')

  await printingRepository.upsertPrintStation(db, businessId, {
    id: 'kitchen', name: 'Cozinha', platform: 'windows', autoPrintEnabled: true, defaultCopies: 1,
  }, baseNow)
  await printingRepository.setPrimaryPrintStation(db, businessId, 'kitchen', baseNow)
  const claimAt = new Date(baseNow.getTime() + 2000)
  await printingRepository.heartbeatPrintStation(db, businessId, 'kitchen', {
    qzReady: true,
    printerReady: true,
  }, claimAt)

  const claimed = await printingRepository.claimNextAutomaticPrintJob(
    db,
    businessId,
    'kitchen',
    claimAt,
  )
  assert.equal(claimed.id, 'urgent-job')
  assert.equal(claimed.priority, 1)
  assert.equal((await printingRepository.loadPrintJob(db, businessId, 'older-job')).status, 'pending')
})

test('prioritize is idempotent for queued jobs and never changes terminal jobs', async () => {
  assert.equal(typeof printingRepository.prioritizePrintJob, 'function')
  const db = makeDb()
  await addAutomaticJob(db, { id: 'queued-job', orderId: 'o1', createdAt: baseNow })
  const first = await printingRepository.prioritizePrintJob(db, businessId, 'queued-job', baseNow)
  const second = await printingRepository.prioritizePrintJob(db, businessId, 'queued-job', new Date(baseNow.getTime() + 1000))
  assert.equal(first.priority, 1)
  assert.equal(second.priority, 1)
  assert.equal(second.status, 'pending')

  await addAutomaticJob(db, { id: 'printed-job', orderId: 'o3', createdAt: baseNow })
  await addAutomaticJob(db, { id: 'discarded-job', orderId: 'o4', createdAt: baseNow })
  db.exec(`
    UPDATE print_jobs SET status = 'printed', copies_printed = copies_requested WHERE id = 'printed-job';
    UPDATE print_jobs SET status = 'discarded', discarded_at = '${baseNow.toISOString()}' WHERE id = 'discarded-job';
  `)

  for (const id of ['printed-job', 'discarded-job']) {
    await assert.rejects(
      () => printingRepository.prioritizePrintJob(db, businessId, id, baseNow),
      (error) => error.code === 'PRINT_JOB_PRIORITIZE_NOT_ALLOWED',
    )
    const preserved = await printingRepository.loadPrintJob(db, businessId, id)
    assert.equal(preserved.priority, 0)
  }
  assert.equal((await printingRepository.loadPrintJob(db, businessId, 'printed-job')).status, 'printed')
  assert.equal((await printingRepository.loadPrintJob(db, businessId, 'discarded-job')).status, 'discarded')
})
