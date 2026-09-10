import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { claimNextPrintJob } from './orderPrintingCentralClaim.js'
import {
  createManualOrderPrintJob,
  heartbeatPrintStation,
  prepareAutomaticPrintJobStatement,
  setPrimaryPrintStation,
  upsertPrintStation,
} from './orderPrintingRepository.js'

class D1Sqlite {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:')
    this.sqlite.exec(`
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
        physical_state TEXT NOT NULL DEFAULT 'verifying',
        physical_status_text TEXT,
        physical_status_code INTEGER,
        physical_status_at TEXT,
        last_offline_at TEXT,
        recovery_state TEXT NOT NULL DEFAULT 'normal',
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

  async batch(statements) {
    const results = []
    for (const statement of statements) results.push(await statement.run())
    return results
  }
}

const businessId = 'amor-e-sabor'
const now = new Date('2026-09-08T20:30:00.000Z')

const addAutomaticJob = async (db, { id, orderId, errorCode = null }) => {
  await db.batch([prepareAutomaticPrintJobStatement(db, businessId, {
    id,
    orderId,
    copies: 1,
    document: { version: 1, type: 'order', order: { id: orderId, number: '0001' } },
    createdAt: now,
    availableAt: now,
  })])
  if (errorCode) {
    await db.prepare(`UPDATE print_jobs SET status = 'pending', last_error_code = ? WHERE id = ?`).bind(errorCode, id).run()
  }
}

const addReadyPrimary = async (db, { autoPrintEnabled = true } = {}) => {
  await upsertPrintStation(db, businessId, {
    id: 'kitchen-qz',
    name: 'Cozinha PC',
    platform: 'windows',
    autoPrintEnabled,
    defaultCopies: 2,
  }, now)
  await setPrimaryPrintStation(db, businessId, 'kitchen-qz', now)
  await heartbeatPrintStation(db, businessId, 'kitchen-qz', { qzReady: true, printerReady: true, physicalState: 'ready' }, now)
}

test('primary QZ station consumes a manual queued job even when automatic printing is disabled', async () => {
  const db = new D1Sqlite()
  db.sqlite.exec(`
    INSERT INTO businesses (id) VALUES ('${businessId}');
    INSERT INTO orders (id, business_id, status) VALUES ('order-manual', '${businessId}', 'Em preparo');
  `)

  await upsertPrintStation(db, businessId, {
    id: 'kitchen-qz',
    name: 'Cozinha PC',
    platform: 'windows',
    autoPrintEnabled: false,
    defaultCopies: 2,
  }, now)
  await setPrimaryPrintStation(db, businessId, 'kitchen-qz', now)
  await heartbeatPrintStation(db, businessId, 'kitchen-qz', { qzReady: true, printerReady: true, physicalState: 'ready' }, now)

  const manual = await createManualOrderPrintJob(db, businessId, {
    id: 'manual-job',
    orderId: 'order-manual',
    copies: 1,
    document: { version: 1, type: 'order', order: { id: 'order-manual', number: '0001' } },
  }, now)

  const claimed = await claimNextPrintJob(db, businessId, 'kitchen-qz', now)
  assert.equal(claimed.id, manual.id)
  assert.equal(claimed.trigger, 'manual')
  assert.equal(claimed.status, 'processing')
  assert.equal(claimed.stationId, 'kitchen-qz')
})

test('primary QZ station claims authorized finalized and cancelled automatic jobs', async (t) => {
  for (const status of ['Finalizado', 'Cancelado']) {
    await t.test(status, async () => {
      const db = new D1Sqlite()
      db.sqlite.exec(`
        INSERT INTO businesses (id) VALUES ('${businessId}');
        INSERT INTO orders (id, business_id, status) VALUES ('order-${status}', '${businessId}', '${status}');
      `)
      await addReadyPrimary(db, { autoPrintEnabled: false })
      await addAutomaticJob(db, { id: `authorized-${status}`, orderId: `order-${status}`, errorCode: 'FORCE_PRINT_AUTHORIZED' })

      const claimed = await claimNextPrintJob(db, businessId, 'kitchen-qz', now)
      assert.equal(claimed.id, `authorized-${status}`)
      assert.equal(claimed.status, 'processing')
      assert.equal(claimed.lastError, null)
    })
  }
})

test('finalized and cancelled automatic jobs without force authorization are not claimed', async (t) => {
  for (const status of ['Finalizado', 'Cancelado']) {
    await t.test(status, async () => {
      const db = new D1Sqlite()
      db.sqlite.exec(`
        INSERT INTO businesses (id) VALUES ('${businessId}');
        INSERT INTO orders (id, business_id, status) VALUES ('order-${status}', '${businessId}', '${status}');
      `)
      await addReadyPrimary(db)
      await addAutomaticJob(db, { id: `unapproved-${status}`, orderId: `order-${status}` })

      assert.equal(await claimNextPrintJob(db, businessId, 'kitchen-qz', now), null)
    })
  }
})

test('normal automatic jobs require auto-print enabled while manual jobs remain claimable', async () => {
  const db = new D1Sqlite()
  db.sqlite.exec(`
    INSERT INTO businesses (id) VALUES ('${businessId}');
    INSERT INTO orders (id, business_id, status) VALUES ('order-active', '${businessId}', 'Em preparo');
  `)
  await addReadyPrimary(db, { autoPrintEnabled: false })
  await addAutomaticJob(db, { id: 'automatic-active', orderId: 'order-active' })
  assert.equal(await claimNextPrintJob(db, businessId, 'kitchen-qz', now), null)

  await db.prepare(`UPDATE print_stations SET auto_print_enabled = 1 WHERE id = ?`).bind('kitchen-qz').run()
  const claimedAutomatic = await claimNextPrintJob(db, businessId, 'kitchen-qz', now)
  assert.equal(claimedAutomatic.id, 'automatic-active')

  const manual = await createManualOrderPrintJob(db, businessId, {
    id: 'manual-after-automatic',
    orderId: 'order-active',
    copies: 1,
    document: { version: 1, type: 'order', order: { id: 'order-active', number: '0001' } },
  }, now)
  assert.equal((await claimNextPrintJob(db, businessId, 'kitchen-qz', now)).id, manual.id)
})

test('claim central rejects a non-primary or non-ready station', async (t) => {
  await t.test('non-primary', async () => {
    const db = new D1Sqlite()
    db.sqlite.exec(`
      INSERT INTO businesses (id) VALUES ('${businessId}');
      INSERT INTO orders (id, business_id, status) VALUES ('order-active', '${businessId}', 'Em preparo');
    `)
    await upsertPrintStation(db, businessId, { id: 'secondary', name: 'Tablet', platform: 'windows', autoPrintEnabled: true, defaultCopies: 1 }, now)
    await addAutomaticJob(db, { id: 'automatic-active', orderId: 'order-active' })
    await assert.rejects(() => claimNextPrintJob(db, businessId, 'secondary', now), (error) => error.code === 'PRINT_STATION_NOT_PRIMARY')
  })

  await t.test('not-ready', async () => {
    const db = new D1Sqlite()
    db.sqlite.exec(`
      INSERT INTO businesses (id) VALUES ('${businessId}');
      INSERT INTO orders (id, business_id, status) VALUES ('order-active', '${businessId}', 'Em preparo');
    `)
    await upsertPrintStation(db, businessId, { id: 'kitchen-qz', name: 'Cozinha PC', platform: 'windows', autoPrintEnabled: true, defaultCopies: 1 }, now)
    await setPrimaryPrintStation(db, businessId, 'kitchen-qz', now)
    await addAutomaticJob(db, { id: 'automatic-active', orderId: 'order-active' })
    await assert.rejects(() => claimNextPrintJob(db, businessId, 'kitchen-qz', now), (error) => error.code === 'PRINT_STATION_NOT_READY')
  })
})

test('requested second copy outranks a priority-one normal job and is claimed only once with auto-print disabled', async () => {
  const db = new D1Sqlite()
  db.sqlite.exec(`
    INSERT INTO businesses (id) VALUES ('${businessId}');
    INSERT INTO orders (id, business_id, status) VALUES
      ('order-second-copy', '${businessId}', 'Em preparo'),
      ('order-normal', '${businessId}', 'Em preparo');
  `)
  await addReadyPrimary(db, { autoPrintEnabled: false })
  await addAutomaticJob(db, { id: 'requested-second-copy', orderId: 'order-second-copy' })
  await db.prepare(`UPDATE print_jobs SET copies_requested = 2, copies_printed = 1,
    second_copy_requested_at = ?, priority = 0 WHERE id = ?`).bind(now.toISOString(), 'requested-second-copy').run()
  const normal = await createManualOrderPrintJob(db, businessId, {
    id: 'priority-normal', orderId: 'order-normal', copies: 1,
    document: { version: 1, type: 'order', order: { id: 'order-normal', number: '0002' } },
  }, now)
  await db.prepare(`UPDATE print_jobs SET priority = 1 WHERE id = ?`).bind(normal.id).run()

  assert.equal((await claimNextPrintJob(db, businessId, 'kitchen-qz', now)).id, 'requested-second-copy')
  assert.equal((await claimNextPrintJob(db, businessId, 'kitchen-qz', now)).id, 'priority-normal')
  assert.equal(await claimNextPrintJob(db, businessId, 'kitchen-qz', now), null)
})

test('finalized and cancelled orders allow only an explicitly requested second-copy continuation', async (t) => {
  for (const status of ['Finalizado', 'Cancelado']) {
    await t.test(status, async () => {
      const db = new D1Sqlite()
      db.sqlite.exec(`
        INSERT INTO businesses (id) VALUES ('${businessId}');
        INSERT INTO orders (id, business_id, status) VALUES
          ('continued-${status}', '${businessId}', '${status}'),
          ('normal-${status}', '${businessId}', '${status}');
      `)
      await addReadyPrimary(db)
      await addAutomaticJob(db, { id: `second-copy-${status}`, orderId: `continued-${status}` })
      await addAutomaticJob(db, { id: `normal-${status}`, orderId: `normal-${status}` })
      await db.prepare(`UPDATE print_jobs SET copies_requested = 2, copies_printed = 1,
        second_copy_requested_at = ? WHERE id = ?`).bind(now.toISOString(), `second-copy-${status}`).run()

      assert.equal((await claimNextPrintJob(db, businessId, 'kitchen-qz', now)).id, `second-copy-${status}`)
      assert.equal(await claimNextPrintJob(db, businessId, 'kitchen-qz', now), null)
    })
  }
})

test('normal central claims return no job while recovery is pending, active, or deferred', async (t) => {
  for (const recoveryState of ['pending', 'active', 'deferred']) {
    await t.test(recoveryState, async () => {
      const db = new D1Sqlite()
      db.sqlite.exec(`
        INSERT INTO businesses (id) VALUES ('${businessId}');
        INSERT INTO orders (id, business_id, status) VALUES ('order-${recoveryState}', '${businessId}', 'Em preparo');
      `)
      await addReadyPrimary(db)
      await addAutomaticJob(db, { id: `job-${recoveryState}`, orderId: `order-${recoveryState}` })
      await db.prepare('UPDATE print_stations SET recovery_state = ? WHERE id = ?').bind(recoveryState, 'kitchen-qz').run()

      assert.equal(await claimNextPrintJob(db, businessId, 'kitchen-qz', now), null)
    })
  }
})
