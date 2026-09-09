import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { handlePrintingApi } from './orderPrintingApi.js'

class D1Sqlite {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:')
    this.sqlite.exec(`
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
        second_copy_requested_at TEXT,
        second_copy_skipped_at TEXT,
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
}

const businessId = 'amor-e-sabor'
const addJob = (db, id, status = 'pending') => db.sqlite.prepare(`INSERT INTO print_jobs (
  id, business_id, order_id, type, trigger, status, priority, copies_requested, copies_printed,
  station_id, snapshot_json, created_at, available_at
) VALUES (?, ?, 'o1', 'order', 'automatic', ?, 0, 1, 0, NULL, ?, ?, ?)`)
  .run(
    id,
    businessId,
    status,
    JSON.stringify({ version: 1, type: 'order', order: { id: 'o1' } }),
    '2026-09-08T18:00:00.000Z',
    '2026-09-08T18:00:00.000Z',
  )

const prioritize = (db, id) => {
  const url = new URL(`https://delivery.example/api/printing/jobs/${encodeURIComponent(id)}/prioritize`)
  const request = new Request(url, {
    method: 'POST',
    headers: { origin: 'https://delivery.example' },
  })
  return handlePrintingApi(request, { DB: db }, { businessId }, url)
}

test('HTTP prioritize accepts an authenticated central request without station or printer data', async () => {
  const db = new D1Sqlite()
  addJob(db, 'job 1')

  const response = await prioritize(db, 'job 1')
  assert.ok(response instanceof Response)
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.job.id, 'job 1')
  assert.equal(payload.job.status, 'pending')
  assert.equal(payload.job.priority, 1)
  assert.equal(payload.job.stationId, null)
})

test('HTTP prioritize preserves terminal jobs and returns a consistent conflict', async () => {
  const db = new D1Sqlite()
  addJob(db, 'printed-job', 'printed')
  db.sqlite.prepare('UPDATE print_jobs SET copies_printed = copies_requested WHERE id = ?').run('printed-job')

  await assert.rejects(
    () => prioritize(db, 'printed-job'),
    (error) => error.status === 409 && error.code === 'PRINT_JOB_PRIORITIZE_NOT_ALLOWED',
  )
  const preserved = db.sqlite.prepare('SELECT status, priority FROM print_jobs WHERE id = ?').get('printed-job')
  assert.equal(preserved.status, 'printed')
  assert.equal(preserved.priority, 0)
})
