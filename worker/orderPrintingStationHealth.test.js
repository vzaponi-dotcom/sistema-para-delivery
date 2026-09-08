import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { handlePrintingApi } from './orderPrintingApi.js'
import * as printingRepository from './orderPrintingRepository.js'

class D1Sqlite {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:')
    this.sqlite.exec(`
      CREATE TABLE businesses (id TEXT PRIMARY KEY);
      CREATE TABLE orders (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Em preparo');
      CREATE TABLE print_stations (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL, platform TEXT NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0, auto_print_enabled INTEGER NOT NULL DEFAULT 0,
        default_copies INTEGER NOT NULL DEFAULT 2, last_seen_at TEXT,
        qz_ready INTEGER NOT NULL DEFAULT 0, printer_ready INTEGER NOT NULL DEFAULT 0, last_ready_at TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
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
      INSERT INTO businesses (id) VALUES ('amor-e-sabor');
      INSERT INTO orders (id, business_id, status) VALUES ('o1', 'amor-e-sabor', 'Em preparo');
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
const baseNow = new Date('2026-09-08T20:00:00.000Z')
const document = { version: 1, type: 'order', order: { id: 'o1', number: '0001' } }

const setupPrimaryWindowsStation = async (db) => {
  await printingRepository.upsertPrintStation(db, businessId, {
    id: 'kitchen',
    name: 'Cozinha',
    platform: 'windows',
    autoPrintEnabled: true,
    defaultCopies: 2,
  }, baseNow)
  await printingRepository.setPrimaryPrintStation(db, businessId, 'kitchen', baseNow)
}

const addAutomaticJob = async (db, id = 'job-1', at = baseNow) => {
  await db.batch([printingRepository.prepareAutomaticPrintJobStatement(db, businessId, {
    id,
    orderId: 'o1',
    copies: 2,
    document,
    createdAt: at,
    availableAt: at,
  })])
}

test('heartbeat records last seen and QZ/printer readiness while preserving the last ready instant', async () => {
  assert.equal(typeof printingRepository.heartbeatPrintStation, 'function')
  const db = new D1Sqlite()
  await setupPrimaryWindowsStation(db)

  const qzOnlyAt = new Date('2026-09-08T20:00:15.000Z')
  await printingRepository.heartbeatPrintStation(db, businessId, 'kitchen', {
    qzReady: true,
    printerReady: false,
  }, qzOnlyAt)

  let raw = db.sqlite.prepare('SELECT last_seen_at, qz_ready, printer_ready, last_ready_at FROM print_stations WHERE id = ?').get('kitchen')
  assert.equal(raw.last_seen_at, qzOnlyAt.toISOString())
  assert.equal(raw.qz_ready, 1)
  assert.equal(raw.printer_ready, 0)
  assert.equal(raw.last_ready_at, null)

  const readyAt = new Date('2026-09-08T20:00:30.000Z')
  const station = await printingRepository.heartbeatPrintStation(db, businessId, 'kitchen', {
    qzReady: true,
    printerReady: true,
  }, readyAt)
  raw = db.sqlite.prepare('SELECT last_seen_at, qz_ready, printer_ready, last_ready_at FROM print_stations WHERE id = ?').get('kitchen')
  assert.equal(raw.last_seen_at, readyAt.toISOString())
  assert.equal(raw.qz_ready, 1)
  assert.equal(raw.printer_ready, 1)
  assert.equal(raw.last_ready_at, readyAt.toISOString())
  assert.equal(station.health.ready, true)
})

test('station health becomes offline after the heartbeat timeout', () => {
  assert.equal(typeof printingRepository.resolvePrintStationHealth, 'function')
  assert.equal(typeof printingRepository.PRINT_STATION_HEARTBEAT_TIMEOUT_MS, 'number')

  const station = {
    id: 'kitchen',
    platform: 'windows',
    isPrimary: true,
    autoPrintEnabled: true,
    lastSeenAt: baseNow.toISOString(),
    qzReady: true,
    printerReady: true,
    lastReadyAt: baseNow.toISOString(),
  }
  const recentAt = new Date(baseNow.getTime() + printingRepository.PRINT_STATION_HEARTBEAT_TIMEOUT_MS - 1)
  const staleAt = new Date(baseNow.getTime() + printingRepository.PRINT_STATION_HEARTBEAT_TIMEOUT_MS + 1)

  assert.deepEqual(printingRepository.resolvePrintStationHealth(station, recentAt), {
    online: true,
    qzReady: true,
    printerReady: true,
    ready: true,
    automaticReady: true,
  })
  assert.deepEqual(printingRepository.resolvePrintStationHealth(station, staleAt), {
    online: false,
    qzReady: false,
    printerReady: false,
    ready: false,
    automaticReady: false,
  })
})

test('automatic claim requires a recent ready heartbeat from the primary Windows station', async () => {
  const db = new D1Sqlite()
  await setupPrimaryWindowsStation(db)
  await addAutomaticJob(db)

  await assert.rejects(
    () => printingRepository.claimNextAutomaticPrintJob(db, businessId, 'kitchen', baseNow),
    (error) => error.code === 'PRINT_STATION_NOT_READY',
  )

  await printingRepository.heartbeatPrintStation(db, businessId, 'kitchen', {
    qzReady: true,
    printerReady: true,
  }, baseNow)
  const claimed = await printingRepository.claimNextAutomaticPrintJob(db, businessId, 'kitchen', baseNow)
  assert.equal(claimed.id, 'job-1')
  assert.equal(claimed.status, 'processing')
})

test('queued automatic jobs derive waiting_station until the primary station is operational', async () => {
  const db = new D1Sqlite()
  await setupPrimaryWindowsStation(db)
  await addAutomaticJob(db)

  let jobs = await printingRepository.listPrintJobs(db, businessId, { now: baseNow })
  assert.equal(jobs[0].queueState, 'waiting_station')

  await printingRepository.heartbeatPrintStation(db, businessId, 'kitchen', {
    qzReady: true,
    printerReady: true,
  }, baseNow)
  jobs = await printingRepository.listPrintJobs(db, businessId, { now: baseNow })
  assert.equal(jobs[0].queueState, 'queued')
})

test('active automatic jobs survive a long station outage and remain claimable after recovery', async () => {
  const db = new D1Sqlite()
  await setupPrimaryWindowsStation(db)
  const oldAt = new Date(baseNow.getTime() - printingRepository.PRINT_PENDING_MAX_AGE_MS - 5 * 60 * 1000)
  await addAutomaticJob(db, 'offline-job', oldAt)

  let jobs = await printingRepository.listPrintJobs(db, businessId, { now: baseNow })
  assert.equal(jobs[0].status, 'pending')
  assert.equal(jobs[0].queueState, 'waiting_station')

  await printingRepository.heartbeatPrintStation(db, businessId, 'kitchen', {
    qzReady: true,
    printerReady: true,
  }, baseNow)
  jobs = await printingRepository.listPrintJobs(db, businessId, { now: baseNow })
  assert.equal(jobs[0].status, 'pending')
  assert.equal(jobs[0].queueState, 'queued')

  const claimed = await printingRepository.claimNextAutomaticPrintJob(db, businessId, 'kitchen', baseNow)
  assert.equal(claimed.id, 'offline-job')
})

test('heartbeat HTTP endpoint accepts only health data and returns derived station health', async () => {
  const db = new D1Sqlite()
  await setupPrimaryWindowsStation(db)
  const url = new URL('https://delivery.example/api/printing/stations/kitchen/heartbeat')
  const request = new Request(url, {
    method: 'POST',
    headers: { origin: 'https://delivery.example', 'content-type': 'application/json' },
    body: JSON.stringify({ qzReady: true, printerReady: true }),
  })

  const response = await handlePrintingApi(request, { DB: db }, { businessId }, url)
  assert.ok(response instanceof Response)
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.station.id, 'kitchen')
  assert.equal(payload.station.health.ready, true)
})
