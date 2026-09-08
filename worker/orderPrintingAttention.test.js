import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import {
  claimNextAutomaticPrintJob,
  claimPrintJob,
  loadPrintJob,
  markPrintJobFailed,
  prepareAutomaticPrintJobStatement,
  retryPrintJob,
  setPrimaryPrintStation,
  upsertPrintStation,
} from './orderPrintingRepository.js'

class D1Sqlite {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:')
    this.sqlite.exec(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE print_stations (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        name TEXT NOT NULL,
        platform TEXT NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0,
        auto_print_enabled INTEGER NOT NULL DEFAULT 0,
        default_copies INTEGER NOT NULL DEFAULT 2,
        last_seen_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX print_stations_one_primary_idx
        ON print_stations (business_id) WHERE is_primary = 1;
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
    const results = []
    for (const statement of statements) results.push(await statement.run())
    return results
  }

  exec(sql) { this.sqlite.exec(sql) }
}

const businessId = 'amor-e-sabor'
const now = new Date('2026-09-08T18:30:00.000Z')

const setup = async ({ orderId = 'order-1', orderStatus = 'Em preparo' } = {}) => {
  const db = new D1Sqlite()
  db.exec(`INSERT INTO orders (id, business_id, status)
    VALUES ('${orderId}', '${businessId}', '${orderStatus}')`)
  await upsertPrintStation(db, businessId, {
    id: 'kitchen',
    name: 'Cozinha',
    platform: 'windows',
    autoPrintEnabled: true,
    defaultCopies: 2,
  }, now)
  await setPrimaryPrintStation(db, businessId, 'kitchen', now)
  return db
}

const addAutomaticJob = async (db, { id = 'job-1', orderId = 'order-1' } = {}) => {
  await db.batch([prepareAutomaticPrintJobStatement(db, businessId, {
    id,
    orderId,
    copies: 2,
    document: { version: 1, type: 'order', order: { id: orderId, number: '0001' } },
    createdAt: now,
    availableAt: now,
  })])
  return loadPrintJob(db, businessId, id)
}

test('QZ failure requires attention with code/message and retry clears the operational error', async () => {
  const db = await setup()
  await addAutomaticJob(db)
  await claimPrintJob(db, businessId, 'job-1', 'kitchen', now)

  const attention = await markPrintJobFailed(db, businessId, 'job-1', 'kitchen', {
    code: 'QZ_PRINT_FAILED',
    message: 'QZ Tray não conseguiu enviar o ticket.',
    uncertain: false,
  }, now)

  assert.equal(attention.status, 'requires_attention')
  assert.deepEqual(attention.lastError, {
    code: 'QZ_PRINT_FAILED',
    message: 'QZ Tray não conseguiu enviar o ticket.',
  })

  const retried = await retryPrintJob(db, businessId, 'job-1', new Date(now.getTime() + 1000))
  assert.equal(retried.status, 'pending')
  assert.equal(retried.stationId, null)
  assert.equal(retried.processingStartedAt, null)
  assert.equal(retried.lastError, null)
})

test('cancelled automatic order pending in the queue is routed to attention instead of being claimed', async () => {
  const db = await setup({ orderId: 'cancelled-order', orderStatus: 'Cancelado' })
  await addAutomaticJob(db, { id: 'cancelled-job', orderId: 'cancelled-order' })

  assert.equal(await claimNextAutomaticPrintJob(db, businessId, 'kitchen', now), null)

  const job = await loadPrintJob(db, businessId, 'cancelled-job')
  assert.equal(job.status, 'requires_attention')
  assert.deepEqual(job.lastError, {
    code: 'ORDER_NOT_PRINTABLE',
    message: 'O pedido foi finalizado ou cancelado antes da impressão automática.',
  })
})

test('finalized automatic order pending in the queue is routed to attention instead of being claimed', async () => {
  const db = await setup({ orderId: 'finalized-order', orderStatus: 'Finalizado' })
  await addAutomaticJob(db, { id: 'finalized-job', orderId: 'finalized-order' })

  assert.equal(await claimNextAutomaticPrintJob(db, businessId, 'kitchen', now), null)
  assert.equal((await loadPrintJob(db, businessId, 'finalized-job')).status, 'requires_attention')
})

test('retry does not resume an automatic job after its order becomes finalized', async () => {
  const db = await setup()
  await addAutomaticJob(db)
  await claimPrintJob(db, businessId, 'job-1', 'kitchen', now)
  await markPrintJobFailed(db, businessId, 'job-1', 'kitchen', {
    code: 'QZ_PRINT_FAILED',
    message: 'Falha no QZ Tray.',
    uncertain: false,
  }, now)

  db.exec(`UPDATE orders SET status = 'Finalizado'
    WHERE id = 'order-1' AND business_id = '${businessId}'`)

  await assert.rejects(
    () => retryPrintJob(db, businessId, 'job-1', new Date(now.getTime() + 1000)),
    (error) => error.code === 'PRINT_JOB_RETRY_NOT_ALLOWED',
  )

  const job = await loadPrintJob(db, businessId, 'job-1')
  assert.equal(job.status, 'requires_attention')
  assert.notEqual(job.status, 'pending')
})
