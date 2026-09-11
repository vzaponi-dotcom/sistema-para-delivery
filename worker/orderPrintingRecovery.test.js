import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { readFile } from 'node:fs/promises'
import {
  claimPrintJob,
  claimNextRecoveryPrintJob,
  discardPendingPrintJobs,
  heartbeatPrintStation,
  loadPrintJob,
  prepareAutomaticPrintJobStatement,
  setPrimaryPrintStation,
  setPrintRecoveryState,
  upsertPrintStation,
} from './orderPrintingRepository.js'
import {
  createPrintJobAttempt,
  markPrintAttemptSubmitting,
  markPrintAttemptUnknown,
  recordPrintAttemptEvent,
  resolveUnknownPrintAttempt,
} from './printAttemptRepository.js'
import { claimNextPrintJob } from './orderPrintingCentralClaim.js'

class D1Sqlite {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:')
    this.sqlite.exec(`
      CREATE TABLE businesses (id TEXT PRIMARY KEY);
      CREATE TABLE orders (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Em preparo');
      CREATE TABLE print_stations (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL, platform TEXT NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0, auto_print_enabled INTEGER NOT NULL DEFAULT 0,
        default_copies INTEGER NOT NULL DEFAULT 2, last_seen_at TEXT, qz_ready INTEGER NOT NULL DEFAULT 0,
        printer_ready INTEGER NOT NULL DEFAULT 0, last_ready_at TEXT,
        physical_state TEXT NOT NULL DEFAULT 'verifying', physical_status_text TEXT, physical_status_code INTEGER,
        physical_status_at TEXT, last_offline_at TEXT, recovery_state TEXT NOT NULL DEFAULT 'normal', recovery_job_id TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE print_jobs (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT, type TEXT NOT NULL, trigger TEXT NOT NULL,
        status TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0, parent_job_id TEXT,
        copies_requested INTEGER NOT NULL, copies_printed INTEGER NOT NULL DEFAULT 0, station_id TEXT,
        snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL, available_at TEXT, processing_started_at TEXT,
        processed_at TEXT, discarded_at TEXT, attention_reason TEXT, action_actor_label TEXT, action_at TEXT,
        second_copy_prompted_at TEXT, second_copy_requested_at TEXT, second_copy_skipped_at TEXT,
        last_error_code TEXT, last_error_message TEXT
      );
      CREATE TABLE print_job_attempts (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, job_id TEXT NOT NULL, copy_number INTEGER NOT NULL,
        attempt_number INTEGER NOT NULL, station_id TEXT, spool_job_name TEXT NOT NULL, spool_job_id INTEGER,
        status TEXT NOT NULL, submission_started_at TEXT, submitted_at TEXT, last_event_at TEXT, completed_at TEXT,
        resolution TEXT, resolution_actor_label TEXT, resolved_at TEXT, last_error_code TEXT,
        last_error_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO businesses (id) VALUES ('amor-e-sabor');
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
const now = new Date('2026-09-10T12:00:00.000Z')
const repositorySource = await readFile(new URL('./orderPrintingRepository.js', import.meta.url), 'utf8')
const documentFor = (orderId) => ({ version: 1, type: 'order', order: { id: orderId, number: orderId } })

const addReadyPrimary = async (db) => {
  await upsertPrintStation(db, businessId, {
    id: 'kitchen', name: 'Cozinha', platform: 'windows', autoPrintEnabled: true, defaultCopies: 2,
  }, now)
  await setPrimaryPrintStation(db, businessId, 'kitchen', now)
}

const addPendingJob = async (db, id, { copies = 2, status = 'pending', copiesPrinted = 0 } = {}) => {
  const orderId = `order-${id}`
  await db.prepare('INSERT INTO orders (id, business_id, status) VALUES (?, ?, ?)').bind(orderId, businessId, 'Em preparo').run()
  await db.batch([prepareAutomaticPrintJobStatement(db, businessId, {
    id, orderId, copies, document: documentFor(orderId), createdAt: now, availableAt: now,
  })])
  await db.prepare('UPDATE print_jobs SET status = ?, copies_printed = ? WHERE id = ?').bind(status, copiesPrinted, id).run()
}

test('offline to ready with safe pending backlog creates one recovery cycle and gates normal claims', async () => {
  const db = new D1Sqlite()
  await addReadyPrimary(db)
  await addPendingJob(db, 'safe-backlog')

  await heartbeatPrintStation(db, businessId, 'kitchen', {
    qzReady: true, printerReady: true, physicalState: 'printer_offline',
  }, new Date(now.getTime() - 1000))
  const recovered = await heartbeatPrintStation(db, businessId, 'kitchen', {
    qzReady: true, printerReady: true, physicalState: 'ready',
  }, now)
  assert.equal(recovered.recoveryState, 'pending')
  assert.equal(await claimNextPrintJob(db, businessId, 'kitchen', now), null)

  await setPrintRecoveryState(db, businessId, 'kitchen', 'normal', now)
  const repeat = await heartbeatPrintStation(db, businessId, 'kitchen', {
    qzReady: true, printerReady: true, physicalState: 'ready',
  }, new Date(now.getTime() + 1000))
  assert.equal(repeat.recoveryState, 'normal')
})

test('stale heartbeat recovery is pending only for a safe backlog', async () => {
  const db = new D1Sqlite()
  await addReadyPrimary(db)
  await addPendingJob(db, 'unsafe-backlog')
  await db.prepare(`INSERT INTO print_job_attempts (
    id, business_id, job_id, copy_number, attempt_number, spool_job_name, status, submission_started_at, created_at, updated_at
  ) VALUES (?, ?, ?, 1, 1, ?, 'unknown', ?, ?, ?)`)
    .bind('attempt-unsafe', businessId, 'unsafe-backlog', 'spool-unsafe', now.toISOString(), now.toISOString(), now.toISOString()).run()
  const staleAt = new Date(now.getTime() - 61_000)
  await heartbeatPrintStation(db, businessId, 'kitchen', {
    qzReady: true, printerReady: true, physicalState: 'ready',
  }, staleAt)

  const recovered = await heartbeatPrintStation(db, businessId, 'kitchen', {
    qzReady: true, printerReady: true, physicalState: 'ready',
  }, now)
  assert.equal(recovered.recoveryState, 'normal')
})

test('recovery claim requires active, claims one safe first copy, then defers the cycle', async () => {
  const db = new D1Sqlite()
  await addReadyPrimary(db)
  await addPendingJob(db, 'first', { copies: 2 })
  await addPendingJob(db, 'second', { copies: 1 })
  await heartbeatPrintStation(db, businessId, 'kitchen', {
    qzReady: true, printerReady: true, physicalState: 'ready',
  }, now)

  assert.equal(await claimNextRecoveryPrintJob(db, businessId, 'kitchen', now), null)
  await setPrintRecoveryState(db, businessId, 'kitchen', 'pending', now)
  assert.equal(await claimNextRecoveryPrintJob(db, businessId, 'kitchen', now), null)
  await setPrintRecoveryState(db, businessId, 'kitchen', 'active', now)

  const claimed = await claimNextRecoveryPrintJob(db, businessId, 'kitchen', now)
  assert.equal(claimed.id, 'first')
  assert.equal(claimed.copiesRequested, 2)
  assert.equal(claimed.copiesPrinted, 0)
  assert.equal(await claimNextRecoveryPrintJob(db, businessId, 'kitchen', now), null)
  assert.equal((await loadPrintJob(db, businessId, 'second')).status, 'pending')
  assert.equal(db.sqlite.prepare('SELECT recovery_state FROM print_stations WHERE id = ?').get('kitchen').recovery_state, 'deferred')
})

test('recovery keeps a two-copy job atomic before claiming the next pending job', async () => {
  const db = new D1Sqlite()
  await addReadyPrimary(db)
  await addPendingJob(db, 'first', { copies: 2 })
  await addPendingJob(db, 'second', { copies: 2 })
  await heartbeatPrintStation(db, businessId, 'kitchen', {
    qzReady: true, printerReady: true, physicalState: 'ready',
  }, now)
  await setPrintRecoveryState(db, businessId, 'kitchen', 'pending', now)
  await setPrintRecoveryState(db, businessId, 'kitchen', 'active', now)

  const firstClaim = await claimNextRecoveryPrintJob(db, businessId, 'kitchen', now)
  assert.equal(firstClaim.id, 'first')
  assert.equal(db.sqlite.prepare('SELECT recovery_job_id FROM print_stations WHERE id = ?').get('kitchen').recovery_job_id, 'first')

  const firstAttempt = await createPrintJobAttempt(db, businessId, {
    jobId: firstClaim.id, stationId: 'kitchen', copyNumber: 1,
  }, now)
  await markPrintAttemptSubmitting(db, businessId, firstAttempt.id, 'kitchen', now)
  await recordPrintAttemptEvent(db, businessId, firstAttempt.id, 'kitchen', {
    type: 'COMPLETE', jobName: firstAttempt.spoolJobName,
  }, now)
  const afterFirstCopy = await loadPrintJob(db, businessId, 'first')
  assert.equal(afterFirstCopy.status, 'awaiting_second_copy')
  assert.equal(afterFirstCopy.copiesPrinted, 1)
  await assert.rejects(
    () => setPrintRecoveryState(db, businessId, 'kitchen', 'normal', now),
    (error) => error.code === 'PRINT_RECOVERY_JOB_UNRESOLVED',
  )

  await setPrintRecoveryState(db, businessId, 'kitchen', 'active', now)
  assert.equal(await claimNextRecoveryPrintJob(db, businessId, 'kitchen', now), null)
  assert.equal((await loadPrintJob(db, businessId, 'second')).status, 'pending')

  const secondCopyClaim = await claimPrintJob(db, businessId, 'first', 'kitchen', now)
  assert.equal(secondCopyClaim.id, 'first')
  const secondAttempt = await createPrintJobAttempt(db, businessId, {
    jobId: secondCopyClaim.id, stationId: 'kitchen', copyNumber: 2,
  }, now)
  assert.equal(secondAttempt.jobId, 'first')
  assert.equal(secondAttempt.copyNumber, 2)

  await markPrintAttemptSubmitting(db, businessId, secondAttempt.id, 'kitchen', now)
  await recordPrintAttemptEvent(db, businessId, secondAttempt.id, 'kitchen', {
    type: 'COMPLETE', jobName: secondAttempt.spoolJobName,
  }, now)
  const completed = await loadPrintJob(db, businessId, 'first')
  assert.equal(completed.status, 'printed')
  assert.equal(completed.copiesPrinted, 2)
  assert.equal(db.sqlite.prepare('SELECT recovery_job_id FROM print_stations WHERE id = ?').get('kitchen').recovery_job_id, null)

  const secondClaim = await claimNextRecoveryPrintJob(db, businessId, 'kitchen', now)
  assert.equal(secondClaim.id, 'second')
})

test('manual not-printed resolution reclaims the affinity job before the next pending job', async () => {
  const db = new D1Sqlite()
  await addReadyPrimary(db)
  await addPendingJob(db, 'first', { copies: 1 })
  await addPendingJob(db, 'second', { copies: 1 })
  await heartbeatPrintStation(db, businessId, 'kitchen', {
    qzReady: true, printerReady: true, physicalState: 'ready',
  }, now)
  await setPrintRecoveryState(db, businessId, 'kitchen', 'pending', now)
  await setPrintRecoveryState(db, businessId, 'kitchen', 'active', now)
  assert.equal((await claimNextRecoveryPrintJob(db, businessId, 'kitchen', now)).id, 'first')

  const attempt = await createPrintJobAttempt(db, businessId, {
    jobId: 'first', stationId: 'kitchen', copyNumber: 1,
  }, now)
  await markPrintAttemptSubmitting(db, businessId, attempt.id, 'kitchen', now)
  await markPrintAttemptUnknown(db, businessId, attempt.id, 'kitchen', 'QZ_CONNECTION_LOST', now)
  await resolveUnknownPrintAttempt(db, businessId, 'first', attempt.id, 'manual_not_printed', 'Operador', now)
  await setPrintRecoveryState(db, businessId, 'kitchen', 'active', now)

  const reclaimed = await claimNextRecoveryPrintJob(db, businessId, 'kitchen', now)
  assert.equal(reclaimed.id, 'first')
  assert.equal((await loadPrintJob(db, businessId, 'second')).status, 'pending')
  assert.equal(db.sqlite.prepare('SELECT recovery_job_id FROM print_stations WHERE id = ?').get('kitchen').recovery_job_id, 'first')
})

test('normal recovery transition checks and clears terminal affinity in one guarded update', () => {
  const start = repositorySource.indexOf('export const setPrintRecoveryState')
  const end = repositorySource.indexOf('export const claimNextAutomaticPrintJob', start)
  const implementation = repositorySource.slice(start, end)
  assert.match(implementation, /UPDATE print_stations SET recovery_state = \?,\s*recovery_job_id = CASE/)
  assert.match(implementation, /NOT EXISTS \(\s*SELECT 1 FROM print_jobs[\s\S]*status NOT IN \('printed', 'discarded'\)/)
})

test('recovery clears a one-copy job affinity after its confirmed completion', async () => {
  const db = new D1Sqlite()
  await addReadyPrimary(db)
  await addPendingJob(db, 'single', { copies: 1 })
  await heartbeatPrintStation(db, businessId, 'kitchen', {
    qzReady: true, printerReady: true, physicalState: 'ready',
  }, now)
  await setPrintRecoveryState(db, businessId, 'kitchen', 'pending', now)
  await setPrintRecoveryState(db, businessId, 'kitchen', 'active', now)

  assert.equal((await claimNextRecoveryPrintJob(db, businessId, 'kitchen', now)).id, 'single')
  assert.equal(db.sqlite.prepare('SELECT recovery_job_id FROM print_stations WHERE id = ?').get('kitchen').recovery_job_id, 'single')
  const attempt = await createPrintJobAttempt(db, businessId, {
    jobId: 'single', stationId: 'kitchen', copyNumber: 1,
  }, now)
  await markPrintAttemptSubmitting(db, businessId, attempt.id, 'kitchen', now)
  await recordPrintAttemptEvent(db, businessId, attempt.id, 'kitchen', {
    type: 'COMPLETE', jobName: attempt.spoolJobName,
  }, now)
  assert.equal((await loadPrintJob(db, businessId, 'single')).status, 'printed')
  assert.equal(db.sqlite.prepare('SELECT recovery_job_id FROM print_stations WHERE id = ?').get('kitchen').recovery_job_id, null)
})

test('recovery safely clears missing or terminal stale affinity before claiming the next job', async () => {
  for (const staleJobId of ['missing', 'terminal']) {
    const db = new D1Sqlite()
    await addReadyPrimary(db)
    await addPendingJob(db, 'next', { copies: 1 })
    if (staleJobId === 'terminal') await addPendingJob(db, 'terminal', { copies: 1, status: 'printed', copiesPrinted: 1 })
    await heartbeatPrintStation(db, businessId, 'kitchen', {
      qzReady: true, printerReady: true, physicalState: 'ready',
    }, now)
    await db.prepare("UPDATE print_stations SET recovery_state = 'active', recovery_job_id = ? WHERE id = ?")
      .bind(staleJobId, 'kitchen').run()

    assert.equal((await claimNextRecoveryPrintJob(db, businessId, 'kitchen', now)).id, 'next')
    assert.equal(db.sqlite.prepare('SELECT recovery_job_id FROM print_stations WHERE id = ?').get('kitchen').recovery_job_id, 'next')
  }
})

test('recovery state transitions accept only the recovery state machine', async () => {
  const db = new D1Sqlite()
  await addReadyPrimary(db)
  await assert.rejects(() => setPrintRecoveryState(db, businessId, 'kitchen', 'active', now), (error) => error.code === 'PRINT_RECOVERY_TRANSITION_NOT_ALLOWED')
  assert.equal((await setPrintRecoveryState(db, businessId, 'kitchen', 'pending', now)).recoveryState, 'pending')
  assert.equal((await setPrintRecoveryState(db, businessId, 'kitchen', 'active', now)).recoveryState, 'active')
  assert.equal((await setPrintRecoveryState(db, businessId, 'kitchen', 'active', now)).recoveryState, 'active')
  assert.equal((await setPrintRecoveryState(db, businessId, 'kitchen', 'deferred', now)).recoveryState, 'deferred')
  assert.equal((await setPrintRecoveryState(db, businessId, 'kitchen', 'normal', now)).recoveryState, 'normal')
  assert.equal((await setPrintRecoveryState(db, businessId, 'kitchen', 'pending', now)).recoveryState, 'pending')
  assert.equal((await setPrintRecoveryState(db, businessId, 'kitchen', 'normal', now)).recoveryState, 'normal')
})

test('bulk discard preserves every non-safe pending job and discards only untouched pending jobs', async () => {
  const db = new D1Sqlite()
  await addReadyPrimary(db)
  await addPendingJob(db, 'safe')
  await addPendingJob(db, 'second-copy', { copies: 2, copiesPrinted: 1 })
  await addPendingJob(db, 'confirmation', { status: 'awaiting_confirmation' })
  await addPendingJob(db, 'attention', { status: 'requires_attention' })
  await addPendingJob(db, 'submitted')
  await db.prepare(`INSERT INTO print_job_attempts (
    id, business_id, job_id, copy_number, attempt_number, spool_job_name, status, submission_started_at, created_at, updated_at
  ) VALUES (?, ?, ?, 1, 1, ?, 'unknown', ?, ?, ?)`)
    .bind('attempt-submitted', businessId, 'submitted', 'spool-submitted', now.toISOString(), now.toISOString(), now.toISOString()).run()

  const discarded = await discardPendingPrintJobs(db, businessId, 'Operador', now)
  assert.deepEqual(discarded.map((job) => job.id), ['safe'])
  for (const [id, status] of [
    ['safe', 'discarded'], ['second-copy', 'pending'], ['confirmation', 'awaiting_confirmation'],
    ['attention', 'requires_attention'], ['submitted', 'pending'],
  ]) assert.equal((await loadPrintJob(db, businessId, id)).status, status)
})
