import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { getPrintQueueSummary, listPrintJobs } from './orderPrintingRepository.js'

class D1Sqlite {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:')
    this.sqlite.exec(`
      CREATE TABLE businesses (id TEXT PRIMARY KEY);
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_number INTEGER,
        client_name_snapshot TEXT, table_tab_id TEXT, status TEXT NOT NULL DEFAULT 'Em preparo'
      );
      CREATE TABLE table_tabs (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, table_identifier TEXT NOT NULL, tab_number INTEGER);
      CREATE TABLE print_stations (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL, platform TEXT NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0, auto_print_enabled INTEGER NOT NULL DEFAULT 0,
        default_copies INTEGER NOT NULL DEFAULT 2, last_seen_at TEXT, qz_ready INTEGER NOT NULL DEFAULT 0,
        printer_ready INTEGER NOT NULL DEFAULT 0, last_ready_at TEXT, physical_state TEXT NOT NULL DEFAULT 'ready',
        physical_status_text TEXT, physical_status_code INTEGER, physical_status_at TEXT, last_offline_at TEXT,
        recovery_state TEXT NOT NULL DEFAULT 'normal', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE print_jobs (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT, table_tab_id TEXT, type TEXT NOT NULL, trigger TEXT NOT NULL,
        status TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0, parent_job_id TEXT,
        copies_requested INTEGER NOT NULL, copies_printed INTEGER NOT NULL DEFAULT 0, station_id TEXT,
        snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL, available_at TEXT, processing_started_at TEXT,
        processed_at TEXT, discarded_at TEXT, attention_reason TEXT, action_actor_label TEXT, action_at TEXT,
        second_copy_prompted_at TEXT, second_copy_requested_at TEXT, second_copy_skipped_at TEXT,
        last_error_code TEXT, last_error_message TEXT
      );
      CREATE TABLE print_job_attempts (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, job_id TEXT NOT NULL, submission_started_at TEXT
      );
      INSERT INTO businesses (id) VALUES ('biz');
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
const doc = (id) => JSON.stringify({ version: 1, type: 'order', order: { id, number: id } })

const addJob = async (db, {
  id, orderNumber, customer = 'Cliente', table = 'Mesa 1', status = 'pending', trigger = 'automatic',
  createdAt = now, processedAt = null, copiesPrinted = 0,
}) => {
  const orderId = `order-${id}`
  const tabId = `tab-${id}`
  await db.prepare('INSERT INTO table_tabs (id, business_id, table_identifier) VALUES (?, ?, ?)')
    .bind(tabId, 'biz', table).run()
  await db.prepare(`INSERT INTO orders (id, business_id, order_number, client_name_snapshot, table_tab_id, status)
    VALUES (?, ?, ?, ?, ?, 'Em preparo')`).bind(orderId, 'biz', orderNumber, customer, tabId).run()
  await db.prepare(`INSERT INTO print_jobs (
    id, business_id, order_id, type, trigger, status, copies_requested, copies_printed, snapshot_json,
    created_at, available_at, processed_at
  ) VALUES (?, 'biz', ?, 'order', ?, ?, 2, ?, ?, ?, ?, ?)`)
    .bind(id, orderId, trigger, status, copiesPrinted, doc(orderId), createdAt.toISOString(), createdAt.toISOString(), processedAt?.toISOString() ?? null).run()
}

const addTableTabJob = async (db, { id = 'comanda-job', number = 42, table = 'Mesa 7', createdAt = now } = {}) => {
  const tabId = `tab-${id}`
  await db.prepare('INSERT INTO table_tabs (id, business_id, table_identifier, tab_number) VALUES (?, ?, ?, ?)').bind(tabId, 'biz', table, number).run()
  await db.prepare(`INSERT INTO print_jobs (
    id, business_id, table_tab_id, type, trigger, status, copies_requested, copies_printed, snapshot_json, created_at, available_at
  ) VALUES (?, 'biz', ?, 'table-tab', 'manual', 'pending', 1, 0, ?, ?, ?)`)
    .bind(id, tabId, JSON.stringify({ type: 'table-tab', tableTab: { id: tabId, number, tableName: table }, items: [], financial: { totalCents: 2500 } }), createdAt.toISOString(), createdAt.toISOString()).run()
}

test('operational list paginates active statuses with numeric stable sorting and exact metadata', async () => {
  const db = new D1Sqlite()
  for (const [id, orderNumber, status] of [
    ['job-10', 10, 'pending'], ['job-2', 2, 'processing'], ['job-30', 30, 'awaiting_confirmation'],
    ['job-40', 40, 'awaiting_second_copy'], ['job-50', 50, 'failed'], ['job-60', 60, 'requires_attention'],
    ['job-70', 70, 'printed'], ['job-80', 80, 'discarded'],
  ]) await addJob(db, { id, orderNumber, status })

  const first = await listPrintJobs(db, 'biz', {
    scope: 'operational', page: 1, pageSize: 2, sortBy: 'orderNumber', sortDir: 'asc', now,
  })
  const second = await listPrintJobs(db, 'biz', {
    scope: 'operational', page: 2, pageSize: 2, sortBy: 'orderNumber', sortDir: 'asc', now,
  })

  assert.deepEqual(first.jobs.map((job) => job.id), ['job-2', 'job-10'])
  assert.deepEqual(second.jobs.map((job) => job.id), ['job-30', 'job-40'])
  assert.deepEqual(first.pageInfo, { page: 1, pageSize: 2, totalItems: 6, totalPages: 3 })
  assert.equal(new Set([...first.jobs, ...second.jobs].map((job) => job.id)).size, 4)
})

test('operational filters and search run before pagination and invalid sort falls back to createdAt descending', async () => {
  const db = new D1Sqlite()
  await addJob(db, { id: 'ana', orderNumber: 42, customer: 'Ana Silva', table: 'Mesa Azul', createdAt: new Date(now - 1000) })
  await addJob(db, { id: 'mesa', orderNumber: 43, customer: 'Bruno', table: 'Mesa Azul', trigger: 'manual', createdAt: now })
  await addJob(db, { id: 'other', orderNumber: 44, customer: 'Carla', table: 'Mesa Verde', status: 'failed', createdAt: new Date(now - 2000) })

  const searchNumber = await listPrintJobs(db, 'biz', { scope: 'operational', search: '42', page: 1, pageSize: 10, now })
  const searchCustomer = await listPrintJobs(db, 'biz', { scope: 'operational', search: 'ana silva', page: 1, pageSize: 10, now })
  const filtered = await listPrintJobs(db, 'biz', {
    scope: 'operational', search: 'mesa azul', trigger: 'manual', status: 'pending', page: 1, pageSize: 1, now,
  })
  const fallback = await listPrintJobs(db, 'biz', {
    scope: 'operational', sortBy: 'unsafe SQL', sortDir: 'sideways', page: 1, pageSize: 10, now,
  })

  assert.deepEqual(searchNumber.jobs.map((job) => job.id), ['ana'])
  assert.deepEqual(searchCustomer.jobs.map((job) => job.id), ['ana'])
  assert.deepEqual(filtered.jobs.map((job) => job.id), ['mesa'])
  assert.deepEqual(filtered.pageInfo, { page: 1, pageSize: 1, totalItems: 1, totalPages: 1 })
  assert.deepEqual(fallback.jobs.map((job) => job.id), ['mesa', 'ana', 'other'])
})

test('operational list searches and sorts consolidated comandas by tab number and table', async () => {
  const db = new D1Sqlite()
  await addTableTabJob(db, { id: 'tab-42', number: 42, table: 'Mesa Azul' })
  await addTableTabJob(db, { id: 'tab-7', number: 7, table: 'Varanda' })

  const sorted = await listPrintJobs(db, 'biz', { scope: 'operational', sortBy: 'orderNumber', sortDir: 'asc', page: 1, pageSize: 10, now })
  assert.deepEqual(sorted.jobs.map((job) => job.id), ['tab-7', 'tab-42'])
  assert.equal(sorted.jobs[0].tableTabId, 'tab-tab-7')
  assert.deepEqual((await listPrintJobs(db, 'biz', { scope: 'operational', search: 'Mesa Azul', page: 1, pageSize: 10, now })).jobs.map((job) => job.id), ['tab-42'])
  assert.deepEqual((await listPrintJobs(db, 'biz', { scope: 'operational', search: '42', page: 1, pageSize: 10, now })).jobs.map((job) => job.id), ['tab-42'])
})

test('recent list contains only ten newest terminal rows and keeps orderId lookup compatibility', async () => {
  const db = new D1Sqlite()
  for (let index = 0; index < 12; index += 1) {
    await addJob(db, {
      id: `terminal-${index}`, orderNumber: index, status: index % 2 ? 'printed' : 'discarded',
      createdAt: new Date(now.getTime() - index * 1000), processedAt: now,
    })
  }
  await addJob(db, { id: 'active', orderNumber: 99, status: 'pending' })

  const recent = await listPrintJobs(db, 'biz', { scope: 'recent', page: 2, pageSize: 10, now })
  const legacy = await listPrintJobs(db, 'biz', { orderId: 'order-terminal-0', now })

  assert.equal(recent.jobs.length, 10)
  assert.deepEqual(recent.jobs.map((job) => job.id), Array.from({ length: 10 }, (_, index) => `terminal-${index}`))
  assert.deepEqual(recent.pageInfo, { page: 1, pageSize: 10, totalItems: 10, totalPages: 1 })
  assert.ok(Array.isArray(legacy))
  assert.deepEqual(legacy.map((job) => job.id), ['terminal-0'])
})

test('queue summary is independent from pagination and counts only safely untouched backlog', async () => {
  const db = new D1Sqlite()
  await addJob(db, { id: 'pending', orderNumber: 1 })
  await addJob(db, { id: 'confirmation', orderNumber: 2, status: 'awaiting_confirmation' })
  await addJob(db, { id: 'second', orderNumber: 3, status: 'awaiting_second_copy', copiesPrinted: 1 })
  await addJob(db, { id: 'failed', orderNumber: 4, status: 'failed' })
  await addJob(db, { id: 'attention', orderNumber: 5, status: 'requires_attention' })
  await addJob(db, { id: 'printed-today', orderNumber: 6, status: 'printed', processedAt: new Date('2026-09-10T08:00:00.000Z') })
  await addJob(db, { id: 'submitted', orderNumber: 7 })
  await db.prepare('INSERT INTO print_job_attempts (id, business_id, job_id, submission_started_at) VALUES (?, ?, ?, ?)')
    .bind('attempt-submitted', 'biz', 'submitted', now.toISOString()).run()

  assert.deepEqual(await getPrintQueueSummary(db, 'biz', now), {
    pending: 2,
    awaitingConfirmation: 1,
    awaitingSecondCopy: 1,
    attention: 2,
    completedToday: 1,
    safeBacklog: 1,
  })
})
