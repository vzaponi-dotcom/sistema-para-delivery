import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import * as printingRepository from './orderPrintingRepository.js'
import {
  PRINT_PENDING_MAX_AGE_MS,
  PRINT_PROCESSING_MAX_AGE_MS,
  claimNextAutomaticPrintJob,
  claimPrintJob,
  createManualOrderPrintJob,
  heartbeatPrintStation,
  listPrintJobs,
  listPrintStations,
  loadAutomaticPrintJobForOrder,
  loadPrimaryAutomaticPrintStation,
  loadPrintJob,
  markPrintJobFailed,
  markPrintJobPrinted,
  prepareAutomaticPrintJobStatement,
  retryPrintJob,
  setPrimaryPrintStation as setPrimaryPrintStationRepository,
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
  platform: overrides.platform || 'windows',
  autoPrintEnabled: overrides.autoPrintEnabled ?? true,
  defaultCopies: overrides.defaultCopies || 2,
}, baseNow)

const setPrimaryPrintStation = async (db, businessId, stationId, at = baseNow) => {
  const station = await setPrimaryPrintStationRepository(db, businessId, stationId, at)
  if (station.platform === 'windows') {
    await heartbeatPrintStation(db, businessId, stationId, {
      qzReady: true,
      printerReady: true,
    }, at)
  }
  return station
}

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
  assert.equal(Object.hasOwn(stations[0], 'availableAt'), false)
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

test('first completion of a two-copy job persists awaiting_second_copy with one copy printed', async () => {
  const db = makeDb()
  await addStation(db, 'station-a')
  await setPrimaryPrintStation(db, businessA, 'station-a', baseNow)
  await addAutomaticJob(db, { id: 'awaiting-second-copy' })
  await claimPrintJob(db, businessA, 'awaiting-second-copy', 'station-a', baseNow)

  const firstCopy = await markPrintJobPrinted(db, businessA, 'awaiting-second-copy', 'station-a', 1, baseNow)

  assert.equal(firstCopy.copiesPrinted, 1)
  assert.notEqual(firstCopy.status, 'printed')
  assert.equal(firstCopy.status, 'awaiting_second_copy')
})

test('second completion of a two-copy job persists printed with two copies printed', async () => {
  const db = makeDb()
  await addStation(db, 'station-a')
  await setPrimaryPrintStation(db, businessA, 'station-a', baseNow)
  await addAutomaticJob(db, { id: 'complete-second-copy' })
  await claimPrintJob(db, businessA, 'complete-second-copy', 'station-a', baseNow)
  await markPrintJobPrinted(db, businessA, 'complete-second-copy', 'station-a', 1, baseNow)
  await claimPrintJob(db, businessA, 'complete-second-copy', 'station-a', baseNow)

  const secondCopy = await markPrintJobPrinted(db, businessA, 'complete-second-copy', 'station-a', 2, baseNow)

  assert.equal(secondCopy.copiesPrinted, 2)
  assert.equal(secondCopy.status, 'printed')
})

test('partial two-copy jobs wait for an explicit second-copy claim and keep their progress', async () => {
  const db = makeDb()
  await addStation(db, 'station-a')
  await setPrimaryPrintStation(db, businessA, 'station-a', baseNow)
  await addAutomaticJob(db, { id: 'split-job' })

  const firstClaim = await claimPrintJob(db, businessA, 'split-job', 'station-a', baseNow)
  assert.equal(firstClaim.copiesPrinted, 0)

  const firstCopy = await markPrintJobPrinted(db, businessA, 'split-job', 'station-a', 1, baseNow)
  assert.equal(firstCopy.status, 'awaiting_second_copy')
  assert.equal(firstCopy.copiesPrinted, 1)

  assert.equal(await claimNextAutomaticPrintJob(db, businessA, 'station-a', baseNow), null)

  const secondClaim = await claimPrintJob(db, businessA, 'split-job', 'station-a', baseNow)
  assert.equal(secondClaim.status, 'processing')
  assert.equal(secondClaim.copiesPrinted, 1)

  const secondCopy = await markPrintJobPrinted(db, businessA, 'split-job', 'station-a', 2, baseNow)
  assert.equal(secondCopy.status, 'printed')
  assert.equal(secondCopy.copiesPrinted, 2)

  await assert.rejects(
    () => claimPrintJob(db, businessA, 'split-job', 'station-a', baseNow),
    (error) => error.code === 'PRINT_JOB_NOT_PENDING',
  )
})

test('retry after a failed second copy preserves the first copy and cannot re-enter the automatic queue', async () => {
  const db = makeDb()
  await addStation(db, 'station-a')
  await setPrimaryPrintStation(db, businessA, 'station-a', baseNow)
  await addAutomaticJob(db, { id: 'split-retry' })

  await claimPrintJob(db, businessA, 'split-retry', 'station-a', baseNow)
  await markPrintJobPrinted(db, businessA, 'split-retry', 'station-a', 1, baseNow)
  await claimPrintJob(db, businessA, 'split-retry', 'station-a', baseNow)
  await markPrintJobFailed(db, businessA, 'split-retry', 'station-a', {
    code: 'SERIAL_OPEN_FAILED', message: 'Impressora desconectada', uncertain: false,
  }, baseNow)

  const failed = await loadPrintJob(db, businessA, 'split-retry')
  assert.equal(failed.status, 'failed')
  assert.equal(failed.copiesPrinted, 1)

  const retried = await retryPrintJob(db, businessA, 'split-retry', baseNow)
  assert.equal(retried.status, 'awaiting_second_copy')
  assert.equal(retried.copiesPrinted, 1)
  assert.equal(await claimNextAutomaticPrintJob(db, businessA, 'station-a', baseNow), null)

  const secondClaim = await claimPrintJob(db, businessA, 'split-retry', 'station-a', baseNow)
  assert.equal(secondClaim.copiesPrinted, 1)
})

test('aging preserves active pending jobs but routes stale processing to requires_attention', async () => {
  const db = makeDb()
  await addStation(db, 'station-a')
  await setPrimaryPrintStation(db, businessA, 'station-a', baseNow)

  const oldPendingAt = new Date(baseNow.getTime() - PRINT_PENDING_MAX_AGE_MS - 1)
  await addAutomaticJob(db, { id: 'old-pending', orderId: 'o1', createdAt: oldPendingAt })

  const processingAt = new Date(baseNow.getTime() - PRINT_PROCESSING_MAX_AGE_MS - 1)
  await addAutomaticJob(db, { id: 'old-processing', orderId: 'o2', createdAt: processingAt })
  await claimPrintJob(db, businessA, 'old-processing', 'station-a', processingAt)

  const claimed = await claimNextAutomaticPrintJob(db, businessA, 'station-a', baseNow)
  assert.equal(claimed.id, 'old-pending')
  assert.equal(claimed.status, 'processing')
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
  await heartbeatPrintStation(db, businessA, 'station-a', { qzReady: true, printerReady: true }, future)
  const claimed = await claimNextAutomaticPrintJob(db, businessA, 'station-a', future)
  assert.equal(claimed.id, 'future-available')
})

test('manual printing leaves a future automatic job pending until its exact availableAt', async () => {
  const future = new Date(baseNow.getTime() + 5 * 60 * 1000)
  const before = new Date(future.getTime() - 1)
  const db = makeDb()
  await addStation(db, 'primary')
  await setPrimaryPrintStation(db, businessA, 'primary', baseNow)
  const automatic = await addAutomaticJob(db, { id: 'future-automatic', availableAt: future })
  const manual = await createManualOrderPrintJob(db, businessA, {
    id: 'manual-now',
    orderId: 'o1',
    copies: 2,
    document,
  }, baseNow)

  await claimPrintJob(db, businessA, manual.id, 'primary', baseNow)
  await markPrintJobPrinted(db, businessA, manual.id, 'primary', 2, baseNow)

  assert.notEqual(manual.id, automatic.id)
  assert.equal((await loadPrintJob(db, businessA, manual.id)).status, 'printed')
  assert.equal((await loadPrintJob(db, businessA, automatic.id)).status, 'pending')
  assert.equal((await loadPrintJob(db, businessA, automatic.id)).availableAt, future.toISOString())
  await heartbeatPrintStation(db, businessA, 'primary', { qzReady: true, printerReady: true }, before)
  assert.equal(await claimNextAutomaticPrintJob(db, businessA, 'primary', before), null)
  await heartbeatPrintStation(db, businessA, 'primary', { qzReady: true, printerReady: true }, future)
  assert.equal((await claimNextAutomaticPrintJob(db, businessA, 'primary', future)).id, automatic.id)
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

test('listPrintJobs exposes centralized queue fields and orders jobs deterministically', async () => {
  const db = makeDb()
  const jobIds = ['priority-job', 'legacy-job', 'available-job', 'created-job', 'stable-a', 'stable-b']
  for (const id of jobIds) {
    await createManualOrderPrintJob(db, businessA, { id, orderId: 'o1', copies: 2, document }, baseNow)
  }

  db.exec(`
    UPDATE print_jobs SET
      priority = 1,
      parent_job_id = 'original-job',
      discarded_at = '2026-09-03T23:09:00.000Z',
      attention_reason = 'PRINTER_OFFLINE',
      action_actor_label = 'Caixa 1',
      action_at = '2026-09-03T23:10:00.000Z',
      created_at = '2026-09-03T23:10:00.000Z',
      available_at = '2026-09-03T23:10:00.000Z'
    WHERE id = 'priority-job';
    UPDATE print_jobs SET created_at = '2026-09-03T23:00:00.000Z', available_at = NULL WHERE id = 'legacy-job';
    UPDATE print_jobs SET created_at = '2026-09-03T23:05:00.000Z', available_at = '2026-09-03T23:01:00.000Z' WHERE id = 'available-job';
    UPDATE print_jobs SET created_at = '2026-09-03T23:02:00.000Z', available_at = NULL WHERE id = 'created-job';
    UPDATE print_jobs SET created_at = '2026-09-03T23:03:00.000Z', available_at = '2026-09-03T23:03:00.000Z' WHERE id IN ('stable-a', 'stable-b');
  `)

  const jobs = await listPrintJobs(db, businessA, { now: baseNow })
  const priorityJob = jobs.find((job) => job.id === 'priority-job')
  const legacyJob = jobs.find((job) => job.id === 'legacy-job')

  assert.deepEqual(jobs.map((job) => job.id), [
    'priority-job', 'legacy-job', 'available-job', 'created-job', 'stable-a', 'stable-b',
  ])
  assert.deepEqual({
    priority: priorityJob.priority,
    parentJobId: priorityJob.parentJobId,
    discardedAt: priorityJob.discardedAt,
    attentionReason: priorityJob.attentionReason,
    actionActorLabel: priorityJob.actionActorLabel,
    actionAt: priorityJob.actionAt,
  }, {
    priority: 1,
    parentJobId: 'original-job',
    discardedAt: '2026-09-03T23:09:00.000Z',
    attentionReason: 'PRINTER_OFFLINE',
    actionActorLabel: 'Caixa 1',
    actionAt: '2026-09-03T23:10:00.000Z',
  })
  assert.deepEqual({
    priority: legacyJob.priority,
    parentJobId: legacyJob.parentJobId,
    discardedAt: legacyJob.discardedAt,
    attentionReason: legacyJob.attentionReason,
    actionActorLabel: legacyJob.actionActorLabel,
    actionAt: legacyJob.actionAt,
  }, {
    priority: 0,
    parentJobId: null,
    discardedAt: null,
    attentionReason: null,
    actionActorLabel: null,
    actionAt: null,
  })
})

test('cancelled automatic order cannot claim its pending second copy', async () => {
  const db = makeDb()
  await addStation(db, 'station-a')
  await setPrimaryPrintStation(db, businessA, 'station-a', baseNow)
  await addAutomaticJob(db, { id: 'cancelled-second-copy' })

  await claimPrintJob(db, businessA, 'cancelled-second-copy', 'station-a', baseNow)
  const firstCopy = await markPrintJobPrinted(
    db,
    businessA,
    'cancelled-second-copy',
    'station-a',
    1,
    baseNow,
  )
  assert.equal(firstCopy.copiesPrinted, 1)

  db.exec(`UPDATE orders SET status = 'Cancelado' WHERE id = 'o1' AND business_id = '${businessA}'`)

  assert.equal(await claimNextAutomaticPrintJob(db, businessA, 'station-a', baseNow), null)
  await assert.rejects(
    () => claimPrintJob(db, businessA, 'cancelled-second-copy', 'station-a', baseNow),
    (error) => error.code === 'PRINT_JOB_NOT_PENDING',
  )

  const preserved = await loadPrintJob(db, businessA, 'cancelled-second-copy')
  assert.equal(preserved.status, 'awaiting_second_copy')
  assert.equal(preserved.copiesPrinted, 1)
})

test('discard preserves the job history, is idempotent, and keeps the job out of automatic claiming', async () => {
  assert.equal(typeof printingRepository.discardPrintJob, 'function')
  const db = makeDb()
  await addStation(db, 'station-a')
  await setPrimaryPrintStation(db, businessA, 'station-a', baseNow)
  const original = await addAutomaticJob(db, { id: 'discard-me' })
  const beforeCount = db.sqlite.prepare('SELECT count(*) AS count FROM print_jobs').get().count
  const discardedAt = new Date(baseNow.getTime() + 30_000)

  const discarded = await printingRepository.discardPrintJob(db, businessA, original.id, 'Caixa 1', discardedAt)
  assert.equal(discarded.status, 'discarded')
  assert.equal(discarded.discardedAt, discardedAt.toISOString())
  assert.equal(discarded.actionAt, discardedAt.toISOString())
  assert.equal(discarded.actionActorLabel, 'Caixa 1')
  assert.deepEqual(discarded.document, original.document)
  assert.equal(db.sqlite.prepare('SELECT count(*) AS count FROM print_jobs').get().count, beforeCount)
  assert.equal(await claimNextAutomaticPrintJob(db, businessA, 'station-a', new Date(discardedAt.getTime() + 1000)), null)
  await assert.rejects(
    () => retryPrintJob(db, businessA, original.id, discardedAt),
    (error) => error.code === 'PRINT_JOB_RETRY_NOT_ALLOWED',
  )

  const repeated = await printingRepository.discardPrintJob(
    db,
    businessA,
    original.id,
    'Outro dispositivo',
    new Date(discardedAt.getTime() + 60_000),
  )
  assert.equal(repeated.discardedAt, discardedAt.toISOString())
  assert.equal(repeated.actionAt, discardedAt.toISOString())
  assert.equal(repeated.actionActorLabel, 'Caixa 1')
})

test('discard rejects an in-flight or fully printed job but allows a pending second copy', async () => {
  assert.equal(typeof printingRepository.discardPrintJob, 'function')
  const db = makeDb()
  await addStation(db, 'station-a')
  await setPrimaryPrintStation(db, businessA, 'station-a', baseNow)

  await addAutomaticJob(db, { id: 'processing-job', orderId: 'o1' })
  await claimPrintJob(db, businessA, 'processing-job', 'station-a', baseNow)
  await assert.rejects(
    () => printingRepository.discardPrintJob(db, businessA, 'processing-job', 'Sistema', baseNow),
    (error) => error.code === 'PRINT_JOB_DISCARD_NOT_ALLOWED',
  )

  await addAutomaticJob(db, { id: 'partial-job', orderId: 'o2' })
  await claimPrintJob(db, businessA, 'partial-job', 'station-a', baseNow)
  await markPrintJobPrinted(db, businessA, 'partial-job', 'station-a', 1, baseNow)
  const partialDiscarded = await printingRepository.discardPrintJob(db, businessA, 'partial-job', 'Sistema', baseNow)
  assert.equal(partialDiscarded.status, 'discarded')
  assert.equal(partialDiscarded.copiesPrinted, 1)

  await createManualOrderPrintJob(db, businessA, { id: 'printed-job', orderId: 'o1', copies: 1, document }, baseNow)
  await claimPrintJob(db, businessA, 'printed-job', 'station-a', baseNow)
  await markPrintJobPrinted(db, businessA, 'printed-job', 'station-a', 1, baseNow)
  await assert.rejects(
    () => printingRepository.discardPrintJob(db, businessA, 'printed-job', 'Sistema', baseNow),
    (error) => error.code === 'PRINT_JOB_DISCARD_NOT_ALLOWED',
  )
})
