import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import {
  createPrintJobAttempt,
  listPrintJobAttempts,
  markPrintAttemptSubmitting,
  markPrintAttemptUnknown,
  recordPrintAttemptEvent,
  resolveUnknownPrintAttempt,
} from './printAttemptRepository.js'
import { loadPrintJob } from './orderPrintingRepository.js'

class D1Sqlite {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:')
    this.sqlite.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE businesses (id TEXT PRIMARY KEY);
      CREATE TABLE print_stations (id TEXT PRIMARY KEY, business_id TEXT NOT NULL);
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
        second_copy_prompted_at TEXT,
        second_copy_requested_at TEXT,
        second_copy_skipped_at TEXT,
        last_error_code TEXT,
        last_error_message TEXT
      );
      CREATE TABLE print_job_attempts (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        copy_number INTEGER NOT NULL,
        attempt_number INTEGER NOT NULL,
        station_id TEXT,
        spool_job_name TEXT NOT NULL UNIQUE,
        spool_job_id INTEGER,
        status TEXT NOT NULL,
        submission_started_at TEXT,
        submitted_at TEXT,
        last_event_at TEXT,
        completed_at TEXT,
        resolution TEXT,
        resolution_actor_label TEXT,
        resolved_at TEXT,
        last_error_code TEXT,
        last_error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (job_id, copy_number, attempt_number)
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
}

const businessId = 'amor-e-sabor'
const now = new Date('2026-09-09T18:30:00.000Z')
const document = JSON.stringify({ version: 1, type: 'order', order: { id: 'order-1', number: '0001' } })

const setup = () => {
  const db = new D1Sqlite()
  db.sqlite.prepare('INSERT INTO businesses (id) VALUES (?)').run(businessId)
  db.sqlite.prepare('INSERT INTO print_stations (id, business_id) VALUES (?, ?)').run('kitchen', businessId)
  for (const id of ['job-1', 'job-2']) {
    db.sqlite.prepare(`INSERT INTO print_jobs (
      id, business_id, order_id, type, trigger, status, copies_requested, copies_printed,
      station_id, snapshot_json, created_at, available_at, processing_started_at
    ) VALUES (?, ?, ?, 'order', 'automatic', 'processing', 2, 0, 'kitchen', ?, ?, ?, ?)`)
      .run(id, businessId, `${id}-order`, document, now.toISOString(), now.toISOString(), now.toISOString())
  }
  return db
}

test('first physical attempt has number one and the deterministic QZ spool name', async () => {
  const db = setup()

  const attempt = await createPrintJobAttempt(db, businessId, {
    jobId: 'job-1', stationId: 'kitchen', copyNumber: 1,
  }, now)

  assert.equal(attempt.copyNumber, 1)
  assert.equal(attempt.attemptNumber, 1)
  assert.equal(attempt.spoolJobName, 'GESTAO-DELIVERY:job-1:COPY:1:ATTEMPT:1')
  assert.equal(attempt.status, 'prepared')
  assert.deepEqual((await listPrintJobAttempts(db, businessId, 'job-1')).map((item) => item.id), [attempt.id])
  await assert.rejects(
    () => createPrintJobAttempt(db, businessId, { jobId: 'job-1', stationId: 'kitchen', copyNumber: 2 }, now),
    (error) => error.code === 'PRINT_ATTEMPT_COPY_NOT_EXPECTED',
  )
})

test('submission and non-complete QZ events do not count a physical copy', async () => {
  const db = setup()
  const attempt = await createPrintJobAttempt(db, businessId, {
    jobId: 'job-1', stationId: 'kitchen', copyNumber: 1,
  }, now)

  const submitting = await markPrintAttemptSubmitting(db, businessId, attempt.id, 'kitchen', now)
  assert.equal(submitting.submissionStartedAt, now.toISOString())
  assert.equal(submitting.status, 'submitting')
  assert.equal((await loadPrintJob(db, businessId, 'job-1')).status, 'awaiting_confirmation')
  assert.equal((await loadPrintJob(db, businessId, 'job-1')).copiesPrinted, 0)

  for (const event of ['SCHEDULED', 'SENT', 'SPOOLING', 'PRINTING', 'RETAINED']) {
    await recordPrintAttemptEvent(db, businessId, attempt.id, 'kitchen', event, now)
    assert.equal((await loadPrintJob(db, businessId, 'job-1')).copiesPrinted, 0)
  }
})

test('first correlated COMPLETE counts once and duplicate COMPLETE is idempotent', async () => {
  const db = setup()
  const attempt = await createPrintJobAttempt(db, businessId, {
    jobId: 'job-1', stationId: 'kitchen', copyNumber: 1,
  }, now)
  await markPrintAttemptSubmitting(db, businessId, attempt.id, 'kitchen', now)

  const complete = await recordPrintAttemptEvent(db, businessId, attempt.id, 'kitchen', { type: 'COMPLETE', spoolJobId: 41 }, now)
  const afterFirstComplete = await loadPrintJob(db, businessId, 'job-1')
  assert.equal(complete.status, 'complete')
  assert.equal(afterFirstComplete.copiesPrinted, 1)
  assert.equal(afterFirstComplete.status, 'awaiting_second_copy')

  await recordPrintAttemptEvent(db, businessId, attempt.id, 'kitchen', 'COMPLETE', new Date(now.getTime() + 1000))
  const afterDuplicate = await loadPrintJob(db, businessId, 'job-1')
  assert.equal(afterDuplicate.copiesPrinted, 1)
  assert.equal(afterDuplicate.status, 'awaiting_second_copy')
})

test('COMPLETE without a persisted submission point cannot count a copy', async () => {
  const db = setup()
  const attempt = await createPrintJobAttempt(db, businessId, {
    jobId: 'job-1', stationId: 'kitchen', copyNumber: 1,
  }, now)

  await assert.rejects(
    () => recordPrintAttemptEvent(db, businessId, attempt.id, 'kitchen', 'COMPLETE', now),
    (error) => error.code === 'PRINT_ATTEMPT_NOT_SUBMITTED',
  )
  assert.equal((await loadPrintJob(db, businessId, 'job-1')).copiesPrinted, 0)
})

test('unknown submission outcomes require explicit one-time human resolution', async () => {
  const db = setup()
  const printedAttempt = await createPrintJobAttempt(db, businessId, {
    jobId: 'job-1', stationId: 'kitchen', copyNumber: 1,
  }, now)
  await markPrintAttemptSubmitting(db, businessId, printedAttempt.id, 'kitchen', now)
  const unknown = await markPrintAttemptUnknown(
    db, businessId, printedAttempt.id, 'kitchen', 'QZ_CONNECTION_LOST', now,
  )
  assert.equal(unknown.status, 'unknown')
  assert.deepEqual((await loadPrintJob(db, businessId, 'job-1')).lastError, {
    code: 'PRINT_OUTCOME_UNKNOWN', message: 'O resultado físico da impressão não foi confirmado.',
  })

  await resolveUnknownPrintAttempt(db, businessId, 'job-1', printedAttempt.id, 'manual_printed', 'Caixa 1', now)
  await resolveUnknownPrintAttempt(db, businessId, 'job-1', printedAttempt.id, 'manual_printed', 'Outro operador', new Date(now.getTime() + 1000))
  const printed = await loadPrintJob(db, businessId, 'job-1')
  assert.equal(printed.copiesPrinted, 1)
  assert.equal(printed.status, 'awaiting_second_copy')

  const retryAttempt = await createPrintJobAttempt(db, businessId, {
    jobId: 'job-2', stationId: 'kitchen', copyNumber: 1,
  }, now)
  await markPrintAttemptSubmitting(db, businessId, retryAttempt.id, 'kitchen', now)
  await recordPrintAttemptEvent(db, businessId, retryAttempt.id, 'kitchen', 'OFFLINE', now)
  await resolveUnknownPrintAttempt(db, businessId, 'job-2', retryAttempt.id, 'manual_not_printed', 'Caixa 1', now)
  assert.equal((await loadPrintJob(db, businessId, 'job-2')).status, 'pending')
  db.sqlite.prepare(`UPDATE print_jobs SET status = 'processing', station_id = 'kitchen' WHERE id = 'job-2'`).run()
  const secondAttempt = await createPrintJobAttempt(db, businessId, {
    jobId: 'job-2', stationId: 'kitchen', copyNumber: 1,
  }, new Date(now.getTime() + 1000))
  assert.equal(secondAttempt.attemptNumber, 2)
})
