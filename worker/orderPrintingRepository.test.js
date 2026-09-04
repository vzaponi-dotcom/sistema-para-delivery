import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import {
  PRINT_PENDING_MAX_AGE_MS,
  PRINT_PROCESSING_MAX_AGE_MS,
  claimNextAutomaticPrintJob,
  claimPrintJob,
  listPrintJobs,
  listPrintStations,
  loadAutomaticPrintJobForOrder,
  loadPrimaryAutomaticPrintStation,
  loadPrintJob,
  markPrintJobFailed,
  markPrintJobPrinted,
  prepareAutomaticPrintJobStatement,
  retryPrintJob,
  setPrimaryPrintStation,
  upsertPrintStation,
} from './orderPrintingRepository.js'

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
        copies_requested INTEGER NOT NULL,
        copies_printed INTEGER NOT NULL DEFAULT 0,
        station_id TEXT,
        snapshot_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        available_at TEXT NOT NULL,
        processing_started_at TEXT,
        processed_at TEXT,
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
          async first() {
            return database.prepare(sql).get(...values) ?? null
          },
          async all() {
            return { results: database.prepare(sql).all(...values) }
          },
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

const businessA = 'amor-e-sabor'
const businessB = 'outro-negocio'
const baseNow = new Date('2026-09-03T23:00:00.000Z')
const document = Object.freeze({ version: 1, type: 'order', order: { id: 'o1', number: '0001' } })

const makeDb = () => {
  const db = new D1Sqlite()
  db.exec(`
    INSERT INTO businesses (id) VALUES ('${businessA}'), ('${businessB}');
    INSERT INTO orders (id, business_id) VALUES ('o1', '${businessA}'), ('o2', '${businessA}'), ('other-o1', '${businessB}');
  `)
  return db
}

const addStation = async (db, id, overrides = {}) => upsertPrintStation(db, overrides.businessId || businessA, {
  id,
  name: overrides.name || id,
  platform: overrides.platform || 'android',
  autoPrintEnabled: overrides.autoPrintEnabled ?? true,
  defaultCopies: overrides.defaultCopies || 2,
}, baseNow)

const addAutomaticJob = async (db, { id, orderId = 'o1', businessId = businessA, createdAt = baseNow, availableAt = createdAt } = {}) => {
  const statement = prepareAutomaticPrintJobStatement(db, businessId, {
    id,
    orderId,
    copies: 2,
    document: { ...document, order: { id: orderId, number: orderId.slice(-4) } },
    createdAt: createdAt.toISOString(),
    availableAt: availableAt.toISOString(),
  })
  await db.batch([statement])
  return loadPrintJob(db, businessId, id)
}

test('station upsert and primary switch preserve exactly one primary station', async () => {
  const db = makeDb()
  await addStation(db, 'station-a')
  await addStation(db, 'station-b', { platform: 'windows' })

  await setPrimaryPrintStation(db, businessA, 'station-a', baseNow)
  await setPrimaryPrintStation(db, businessA, 'station-b', new Date(baseNow.getTime() + 1000))

  const stations = await listPrintStations(db, businessA)
  assert.equal(stations.filter((station) => station.isPrimary).length, 1)
  assert.equal(stations.find((station) => station.isPrimary).id, 'station-b')
  assert.equal((await loadPrimaryAutomaticPrintStation(db, businessA)).id, 'station-b')
})

test('automatic jobs are unique per order and only the current primary station can atomically claim one', async () => {
  const db = makeDb()
  await addStation(db, 'primary')
  await addStation(db, 'secondary')
  await setPrimaryPrintStation(db, businessA, 'primary', baseNow)
  await addAutomaticJob(db, { id: 'job-1' })

  await assert.rejects(
    () => claimNextAutomaticPrintJob(db, businessA, 'secondary', baseNow),
    (error) => error.code === 'PRINT_STATION_NOT_PRIMARY',
  )

  const claimed = await claimNextAutomaticPrintJob(db, businessA, 'primary', baseNow)
  assert.equal(claimed.id, 'job-1')
  assert.equal(claimed.status, 'processing')
  assert.equal(claimed.stationId, 'primary')
  assert.equal(await claimNextAutomaticPrintJob(db, businessA, 'primary', baseNow), null)
  assert.equal((await loadAutomaticPrintJobForOrder(db, businessA, 'o1')).id, 'job-1')

  const duplicate = prepareAutomaticPrintJobStatement(db, businessA, {
    id: 'job-duplicate', orderId: 'o1', copies: 2, document, createdAt: baseNow.toISOString(),
  })
  await assert.rejects(() => db.batch([duplicate]))
})

test('known failures become failed, uncertain failures require attention, and retry preserves the immutable snapshot', async () => {
  const db = makeDb()
  await addStation(db, 'station-a')
  await setPrimaryPrintStation(db, businessA, 'station-a', baseNow)
  await addAutomaticJob(db, { id: 'known-failure' })
  await claimPrintJob(db, businessA, 'known-failure', 'station-a', baseNow)
  const original = await loadPrintJob(db, businessA, 'known-failure')

  await markPrintJobFailed(db, businessA, 'known-failure', 'station-a', {
    code: 'SERIAL_OPEN_FAILED', message: 'Impressora desconectada', uncertain: false,
  }, baseNow)
  assert.equal((await loadPrintJob(db, businessA, 'known-failure')).status, 'failed')

  const retried = await retryPrintJob(db, businessA, 'known-failure', baseNow)
  assert.equal(retried.status, 'pending')
  assert.equal(retried.id, original.id)
  assert.deepEqual(retried.document, original.document)

  await claimPrintJob(db, businessA, 'known-failure', 'station-a', baseNow)
  await markPrintJobFailed(db, businessA, 'known-failure', 'station-a', {
    code: 'SERIAL_WRITE_UNCERTAIN', message: 'Conexão caiu durante a escrita', uncertain: true,
  }, baseNow)
  assert.equal((await loadPrintJob(db, businessA, 'known-failure')).status, 'requires_attention')
})

test('printed transition records copies and rejects completion from another station', async () => {
  const db = makeDb()
  await addStation(db, 'station-a')
  await addStation(db, 'station-b')
  await setPrimaryPrintStation(db, businessA, 'station-a', baseNow)
  await addAutomaticJob(db, { id: 'job-print' })
  await claimPrintJob(db, businessA, 'job-print', 'station-a', baseNow)

  await assert.rejects(
    () => markPrintJobPrinted(db, businessA, 'job-print', 'station-b', 2, baseNow),
    (error) => error.code === 'PRINT_JOB_NOT_PROCESSING',
  )
  const printed = await markPrintJobPrinted(db, businessA, 'job-print', 'station-a', 2, baseNow)
  assert.equal(printed.status, 'printed')
  assert.equal(printed.copiesPrinted, 2)
})

test('aging moves stale pending and processing jobs to requires_attention before automatic claim', async () => {
  const db = makeDb()
  await addStation(db, 'station-a')
  await setPrimaryPrintStation(db, businessA, 'station-a', baseNow)

  const oldPendingAt = new Date(baseNow.getTime() - PRINT_PENDING_MAX_AGE_MS - 1)
  await addAutomaticJob(db, { id: 'old-pending', orderId: 'o1', createdAt: oldPendingAt })

  const processingAt = new Date(baseNow.getTime() - PRINT_PROCESSING_MAX_AGE_MS - 1)
  await addAutomaticJob(db, { id: 'old-processing', orderId: 'o2', createdAt: processingAt })
  await claimPrintJob(db, businessA, 'old-processing', 'station-a', processingAt)

  assert.equal(await claimNextAutomaticPrintJob(db, businessA, 'station-a', baseNow), null)
  assert.equal((await loadPrintJob(db, businessA, 'old-pending')).status, 'requires_attention')
  assert.equal((await loadPrintJob(db, businessA, 'old-processing')).status, 'requires_attention')
})

test('automatic print waits for availableAt before aging or claim', async () => {
  const future = new Date(baseNow.getTime() + 5 * 60 * 1000)
  const db = makeDb()
  await addStation(db, 'station-a')
  await setPrimaryPrintStation(db, businessA, 'station-a', baseNow)
  const job = await addAutomaticJob(db, { id: 'future-available', createdAt: new Date(baseNow.getTime() - 3 * 60 * 60 * 1000), availableAt: future })
  assert.equal(job.availableAt, future.toISOString())
  assert.equal(await claimNextAutomaticPrintJob(db, businessA, 'station-a', baseNow), null)
  const claimed = await claimNextAutomaticPrintJob(db, businessA, 'station-a', future)
  assert.equal(claimed.id, 'future-available')
})

test('job and station reads are isolated by business id', async () => {
  const db = makeDb()
  await addStation(db, 'station-a')
  await addStation(db, 'other-station', { businessId: businessB })
  await addAutomaticJob(db, { id: 'job-a', orderId: 'o1' })
  await addAutomaticJob(db, { id: 'job-b', orderId: 'other-o1', businessId: businessB })

  assert.deepEqual((await listPrintStations(db, businessA)).map((item) => item.id), ['station-a'])
  assert.deepEqual((await listPrintJobs(db, businessA)).map((item) => item.id), ['job-a'])
  assert.equal(await loadPrintJob(db, businessA, 'job-b'), null)
})
