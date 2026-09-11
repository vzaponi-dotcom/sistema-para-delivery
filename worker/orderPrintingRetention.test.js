import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { purgeExpiredTerminalPrintJobs } from './orderPrintingRepository.js'

class D1Sqlite {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:')
    this.sqlite.exec(`
      CREATE TABLE print_jobs (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT, type TEXT NOT NULL, trigger TEXT NOT NULL,
        status TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0, parent_job_id TEXT, copies_requested INTEGER NOT NULL,
        copies_printed INTEGER NOT NULL DEFAULT 0, station_id TEXT, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL,
        available_at TEXT, processing_started_at TEXT, processed_at TEXT, discarded_at TEXT, attention_reason TEXT,
        action_actor_label TEXT, action_at TEXT, second_copy_prompted_at TEXT, second_copy_requested_at TEXT,
        second_copy_skipped_at TEXT, last_error_code TEXT, last_error_message TEXT
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

const now = new Date('2026-09-10T15:00:00.000Z')
const addJob = async (db, id, status, processedAt) => db.prepare(`INSERT INTO print_jobs (
  id, business_id, type, trigger, status, copies_requested, copies_printed, snapshot_json, created_at, processed_at, discarded_at
) VALUES (?, 'biz', 'order', 'manual', ?, 1, 0, '{}', ?, ?, ?)`)
  .bind(id, status, processedAt.toISOString(), processedAt.toISOString(), status === 'discarded' ? processedAt.toISOString() : null).run()

test('retention purges terminal jobs at or beyond thirty days and preserves all non-terminal states', async () => {
  const db = new D1Sqlite()
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  await addJob(db, 'printed-expired', 'printed', new Date(cutoff.getTime() - 1))
  await addJob(db, 'discarded-at-cutoff', 'discarded', cutoff)
  await addJob(db, 'printed-recent', 'printed', new Date(cutoff.getTime() + 1))
  for (const status of ['failed', 'requires_attention', 'pending', 'processing', 'awaiting_confirmation', 'awaiting_second_copy']) {
    await addJob(db, `keep-${status}`, status, new Date(cutoff.getTime() - 86_400_000))
  }

  assert.equal(await purgeExpiredTerminalPrintJobs(db, 'biz', now), 2)
  assert.deepEqual(db.sqlite.prepare('SELECT id FROM print_jobs ORDER BY id').all().map((row) => row.id), [
    'keep-awaiting_confirmation', 'keep-awaiting_second_copy', 'keep-failed', 'keep-pending', 'keep-processing',
    'keep-requires_attention', 'printed-recent',
  ])
})
