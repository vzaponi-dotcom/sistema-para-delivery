import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import * as printingRepository from './orderPrintingRepository.js'
import {
  claimPrintJob,
  loadPrintJob,
  markPrintJobPrinted,
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
        status TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0, parent_job_id TEXT,
        copies_requested INTEGER NOT NULL, copies_printed INTEGER NOT NULL DEFAULT 0,
        station_id TEXT, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL, available_at TEXT,
        processing_started_at TEXT, processed_at TEXT, discarded_at TEXT, attention_reason TEXT,
        action_actor_label TEXT, action_at TEXT, last_error_code TEXT, last_error_message TEXT
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
const now = new Date('2026-09-08T19:00:00.000Z')

const setup = async ({ table = false } = {}) => {
  const db = new D1Sqlite()
  db.exec(`INSERT INTO orders (id, business_id, status) VALUES ('order-1', '${businessId}', 'Em preparo')`)
  await upsertPrintStation(db, businessId, {
    id: 'kitchen', name: 'Cozinha', platform: 'windows', autoPrintEnabled: true, defaultCopies: 2,
  }, now)
  await setPrimaryPrintStation(db, businessId, 'kitchen', now)

  const document = {
    version: 1,
    type: 'order',
    order: { id: 'order-1', number: '0001' },
    customer: table
      ? { identityType: 'table', name: 'Mesa 01' }
      : { identityType: 'registered_client', name: 'Maria' },
  }
  await db.batch([prepareAutomaticPrintJobStatement(db, businessId, {
    id: 'original-job',
    orderId: 'order-1',
    copies: table ? 1 : 2,
    document,
    createdAt: now,
    availableAt: now,
  })])
  await claimPrintJob(db, businessId, 'original-job', 'kitchen', now)
  await markPrintJobPrinted(db, businessId, 'original-job', 'kitchen', table ? 1 : 2, now)
  return { db, document }
}

test('reprint creates a new linked manual job using the current official order snapshot and leaves the printed original untouched', async () => {
  assert.equal(typeof printingRepository.reprintPrintJob, 'function')
  const { db, document } = await setup()
  const originalBefore = await loadPrintJob(db, businessId, 'original-job')
  const countBefore = db.sqlite.prepare('SELECT count(*) AS count FROM print_jobs').get().count
  const currentDocument = {
    ...document,
    customer: { ...document.customer, name: 'Maria Atualizada' },
  }

  const reprint = await printingRepository.reprintPrintJob(
    db,
    businessId,
    'original-job',
    2,
    currentDocument,
    new Date(now.getTime() + 1000),
  )

  assert.notEqual(reprint.id, originalBefore.id)
  assert.equal(reprint.parentJobId, originalBefore.id)
  assert.equal(reprint.orderId, originalBefore.orderId)
  assert.equal(reprint.type, 'order')
  assert.equal(reprint.trigger, 'manual')
  assert.equal(reprint.status, 'pending')
  assert.equal(reprint.copiesRequested, 2)
  assert.equal(reprint.copiesPrinted, 0)
  assert.equal(reprint.stationId, null)
  assert.deepEqual(reprint.document, currentDocument)
  assert.notDeepEqual(reprint.document, originalBefore.document)
  assert.equal(db.sqlite.prepare('SELECT count(*) AS count FROM print_jobs').get().count, countBefore + 1)

  const originalAfter = await loadPrintJob(db, businessId, 'original-job')
  assert.deepEqual(originalAfter, originalBefore)
  assert.equal(originalAfter.status, 'printed')
})

test('reprint accepts either one or two requested copies from the same printed original', async () => {
  const { db, document } = await setup()

  const one = await printingRepository.reprintPrintJob(db, businessId, 'original-job', 1, document, now)
  const two = await printingRepository.reprintPrintJob(db, businessId, 'original-job', 2, document, new Date(now.getTime() + 1))

  assert.equal(one.copiesRequested, 1)
  assert.equal(two.copiesRequested, 2)
  assert.equal(one.parentJobId, 'original-job')
  assert.equal(two.parentJobId, 'original-job')
  assert.notEqual(one.id, two.id)
})

test('a table automatic ticket that originally had one copy can be manually reprinted with two copies', async () => {
  const { db, document } = await setup({ table: true })

  const reprint = await printingRepository.reprintPrintJob(db, businessId, 'original-job', 2, document, now)

  assert.equal(reprint.copiesRequested, 2)
  assert.equal(reprint.parentJobId, 'original-job')
  assert.equal(reprint.trigger, 'manual')
  assert.equal(reprint.document.customer.identityType, 'table')
})

test('reprint rejects a job that has not finished printing', async () => {
  const db = new D1Sqlite()
  db.exec(`INSERT INTO orders (id, business_id, status) VALUES ('order-1', '${businessId}', 'Em preparo')`)
  const document = { version: 1, type: 'order', order: { id: 'order-1' } }
  await db.batch([prepareAutomaticPrintJobStatement(db, businessId, {
    id: 'pending-job', orderId: 'order-1', copies: 1,
    document, createdAt: now, availableAt: now,
  })])

  await assert.rejects(
    () => printingRepository.reprintPrintJob(db, businessId, 'pending-job', 1, document, now),
    (error) => error.code === 'PRINT_JOB_REPRINT_NOT_ALLOWED',
  )
})

test('reprint accepts discarded and physically-uncertain order jobs, but rejects retryable and force-print attention', async () => {
  const { db, document } = await setup()

  db.sqlite.prepare("UPDATE print_jobs SET status = 'discarded' WHERE id = ?").run('original-job')
  const discarded = await printingRepository.reprintPrintJob(db, businessId, 'original-job', 1, document, now)
  assert.equal(discarded.parentJobId, 'original-job')

  db.sqlite.prepare("UPDATE print_jobs SET status = 'requires_attention', last_error_code = ? WHERE id = ?")
    .run('PROCESSING_OUTCOME_UNKNOWN', 'original-job')
  const uncertain = await printingRepository.reprintPrintJob(db, businessId, 'original-job', 2, document, now)
  assert.equal(uncertain.parentJobId, 'original-job')

  for (const code of ['QZ_PRINT_FAILED', 'ORDER_FINALIZED_BEFORE_PRINT']) {
    db.sqlite.prepare("UPDATE print_jobs SET status = 'requires_attention', last_error_code = ? WHERE id = ?")
      .run(code, 'original-job')
    await assert.rejects(
      () => printingRepository.reprintPrintJob(db, businessId, 'original-job', 1, document, now),
      (error) => error.code === 'PRINT_JOB_REPRINT_NOT_ALLOWED',
    )
  }
})

test('reprint allows finalized orders but rejects cancelled orders from the authoritative order state', async () => {
  const { db, document } = await setup()

  db.sqlite.prepare("UPDATE orders SET status = 'Finalizado' WHERE id = ?").run('order-1')
  const finalized = await printingRepository.reprintPrintJob(db, businessId, 'original-job', 1, document, now)
  assert.equal(finalized.status, 'pending')

  db.sqlite.prepare("UPDATE orders SET status = 'Cancelado' WHERE id = ?").run('order-1')
  await assert.rejects(
    () => printingRepository.reprintPrintJob(db, businessId, 'original-job', 1, document, now),
    (error) => error.code === 'PRINT_JOB_REPRINT_NOT_ALLOWED',
  )
})
