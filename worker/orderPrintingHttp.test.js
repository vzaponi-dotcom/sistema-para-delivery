import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { createSession, hashPin, sessionCookie } from './auth.js'
import { handleRequest } from './index.js'

class D1Sqlite {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:')
    this.sqlite.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE auth_credentials (business_id TEXT PRIMARY KEY, pin_hash TEXT NOT NULL);
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL, expires_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, revoked_at TEXT
      );
      CREATE TABLE businesses (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE business_print_settings (
        business_id TEXT PRIMARY KEY REFERENCES businesses(id),
        default_copies INTEGER NOT NULL DEFAULT 2 CHECK (default_copies IN (1, 2)),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, client_id TEXT, client_name_snapshot TEXT NOT NULL,
        client_phone_snapshot TEXT NOT NULL DEFAULT '', client_address_snapshot TEXT NOT NULL DEFAULT '',
        customer_identity_type TEXT NOT NULL DEFAULT 'registered_client', table_tab_id TEXT,
        type TEXT NOT NULL, order_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Em preparo', subtotal_cents INTEGER NOT NULL,
        delivery_fee_cents INTEGER NOT NULL DEFAULT 0, adjustment_type TEXT NOT NULL DEFAULT 'none',
        adjustment_amount_cents INTEGER NOT NULL DEFAULT 0, adjustment_reason TEXT NOT NULL DEFAULT '',
        total_cents INTEGER NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE order_items (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT NOT NULL, name_snapshot TEXT NOT NULL,
        size_snapshot TEXT NOT NULL DEFAULT '', quantity INTEGER NOT NULL, unit_price_cents INTEGER NOT NULL,
        note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT NOT NULL, method TEXT NOT NULL, paid_at TEXT NOT NULL
      );
      CREATE TABLE table_tabs (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, table_identifier TEXT NOT NULL
      );
      CREATE TABLE print_stations (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL, platform TEXT NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0, auto_print_enabled INTEGER NOT NULL DEFAULT 0,
        default_copies INTEGER NOT NULL DEFAULT 2, last_seen_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX print_stations_one_primary_idx ON print_stations (business_id) WHERE is_primary = 1;
      CREATE TABLE print_jobs (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT, type TEXT NOT NULL, trigger TEXT NOT NULL,
        status TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0, parent_job_id TEXT,
        copies_requested INTEGER NOT NULL, copies_printed INTEGER NOT NULL DEFAULT 0,
        station_id TEXT, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL, available_at TEXT, processing_started_at TEXT,
        processed_at TEXT, discarded_at TEXT, attention_reason TEXT, action_actor_label TEXT, action_at TEXT,
        last_error_code TEXT, last_error_message TEXT
      );
      CREATE UNIQUE INDEX print_jobs_one_auto_order_idx ON print_jobs (business_id, order_id)
        WHERE type = 'order' AND trigger = 'automatic';
    `)
  }
  prepare(sql) {
    const database = this.sqlite
    return { bind(...values) { return {
      async first() { return database.prepare(sql).get(...values) ?? null },
      async all() { return { results: database.prepare(sql).all(...values) } },
      async run() { const result = database.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes || 0) } } },
    } } }
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

const makeEnv = async () => {
  const DB = new D1Sqlite()
  const pinHash = await hashPin('4827', new Uint8Array(16).fill(7))
  DB.sqlite.prepare('INSERT INTO auth_credentials (business_id, pin_hash) VALUES (?, ?)').run('amor-e-sabor', pinHash)
  DB.exec(`
    INSERT INTO businesses (id, name) VALUES ('amor-e-sabor', 'Amor & Sabor'), ('other-business', 'Outro');
    INSERT INTO orders (
      id, business_id, client_name_snapshot, client_phone_snapshot, client_address_snapshot, type,
      order_date, subtotal_cents, delivery_fee_cents, adjustment_type, adjustment_amount_cents,
      adjustment_reason, total_cents, created_at
    ) VALUES ('o1', 'amor-e-sabor', 'Maria', '(11) 99876-5432', 'Rua A, 10', 'Entrega',
      '2026-09-03', 5000, 800, 'none', 0, '', 5800, '2026-09-03T23:00:00.000Z');
    INSERT INTO order_items (
      id, business_id, order_id, name_snapshot, size_snapshot, quantity, unit_price_cents, note, created_at
    ) VALUES ('i1', 'amor-e-sabor', 'o1', 'X-BURGER', 'G', 1, 5000, 'sem cebola', '2026-09-03T23:00:00.000Z');
  `)
  return {
    DB,
    LOGIN_RATE_LIMITER: { limit: async () => ({ success: true }) },
    ASSETS: { fetch: async () => new Response('asset') },
  }
}

const mutationHeaders = (cookie) => ({
  origin: 'https://delivery.example',
  'content-type': 'application/json',
  cookie,
})
const loginCookie = async (env) => {
  const response = await handleRequest(new Request('https://delivery.example/api/auth/login', {
    method: 'POST',
    headers: { origin: 'https://delivery.example', 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '4827' }),
  }), env)
  assert.equal(response.status, 200)
  return response.headers.get('set-cookie').split(';')[0]
}
const jsonRequest = (path, method, cookie, body) => handleRequest(new Request(`https://delivery.example${path}`, {
  method,
  headers: mutationHeaders(cookie),
  body: body === undefined ? undefined : JSON.stringify(body),
}), currentEnv)

let currentEnv

test('central copies are shared by authenticated devices and isolated by the session business', async () => {
  currentEnv = await makeEnv()
  currentEnv.DB.exec(`INSERT INTO business_print_settings VALUES
    ('amor-e-sabor', 1, '2026-09-08T10:00:00.000Z', '2026-09-08T10:00:00.000Z'),
    ('other-business', 2, '2026-09-08T10:00:00.000Z', '2026-09-08T10:00:00.000Z')`)
  const firstDevice = await loginCookie(currentEnv)
  const secondDevice = await loginCookie(currentEnv)
  const other = await createSession(currentEnv, 'other-business')
  const otherCookie = sessionCookie(other.token, 3600).split(';')[0]
  const read = (cookie) => jsonRequest('/api/printing/settings', 'GET', cookie)

  const migrated = await read(firstDevice)
  assert.equal(migrated.status, 200)
  assert.deepEqual(await migrated.json(), { settings: { defaultCopies: 1 } })
  for (const [cookie, defaultCopies] of [[secondDevice, 2], [firstDevice, 1]]) {
    const saved = await jsonRequest('/api/printing/settings', 'PUT', cookie, { defaultCopies })
    assert.equal(saved.status, 200)
    assert.deepEqual(await saved.json(), { settings: { defaultCopies } })
    assert.deepEqual(await (await read(secondDevice)).json(), { settings: { defaultCopies } })
  }
  assert.deepEqual(await (await read(otherCookie)).json(), { settings: { defaultCopies: 2 } })
  const savedOther = await jsonRequest('/api/printing/settings', 'PUT', otherCookie, { defaultCopies: 1 })
  assert.equal(savedOther.status, 200)
  assert.equal((await jsonRequest('/api/printing/settings', 'PUT', firstDevice, { defaultCopies: 2 })).status, 200)
  assert.deepEqual(await (await read(otherCookie)).json(), { settings: { defaultCopies: 1 } })
  assert.equal(currentEnv.DB.sqlite.prepare('SELECT created_at FROM business_print_settings WHERE business_id = ?').get('amor-e-sabor').created_at, '2026-09-08T10:00:00.000Z')
})

test('central settings default to two for a new business and persist independently of station updates and existing jobs', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  const defaults = await jsonRequest('/api/printing/settings', 'GET', cookie)
  assert.equal(defaults.status, 200)
  assert.deepEqual(await defaults.json(), { settings: { defaultCopies: 2 } })
  const job = (await (await jsonRequest('/api/orders/o1/print-jobs', 'POST', cookie, { copies: 2 })).json()).job
  const before = currentEnv.DB.sqlite.prepare('SELECT * FROM print_jobs WHERE id = ?').get(job.id)
  assert.equal((await jsonRequest('/api/printing/settings', 'PUT', cookie, { defaultCopies: 1 })).status, 200)
  await jsonRequest('/api/printing/stations/legacy', 'PUT', cookie, {
    name: 'Legacy', platform: 'windows', autoPrintEnabled: true, defaultCopies: 2,
  })
  await jsonRequest('/api/printing/stations/legacy/make-primary', 'POST', cookie)
  assert.deepEqual(await (await jsonRequest('/api/printing/settings', 'GET', cookie)).json(), { settings: { defaultCopies: 1 } })
  assert.deepEqual(currentEnv.DB.sqlite.prepare('SELECT * FROM print_jobs WHERE id = ?').get(job.id), before)
})

test('central settings reject missing, extra and non-integer copies without changing persisted settings', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  for (const body of [{}, { defaultCopies: 1, businessId: 'other-business' }, { defaultCopies: 2, stationId: 's1' }]) {
    const response = await jsonRequest('/api/printing/settings', 'PUT', cookie, body)
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error.code, 'INVALID_PRINT_SETTINGS')
  }
  for (const defaultCopies of [0, 3, -1, 1.5, '1', '2', true, false, null, [], {}]) {
    const response = await jsonRequest('/api/printing/settings', 'PUT', cookie, { defaultCopies })
    assert.equal(response.status, 400, JSON.stringify({ defaultCopies }))
    assert.equal((await response.json()).error.code, 'INVALID_PRINT_COPIES')
  }
  for (const body of [undefined, null, [], 'invalid']) {
    const response = await jsonRequest('/api/printing/settings', 'PUT', cookie, body)
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error.code, 'INVALID_JSON')
  }
  assert.equal(currentEnv.DB.sqlite.prepare('SELECT count(*) AS count FROM business_print_settings').get().count, 0)
})

test('central settings require authentication for reads and writes and same origin for writes', async () => {
  currentEnv = await makeEnv()
  for (const method of ['GET', 'PUT']) {
    const response = await jsonRequest('/api/printing/settings', method, '', method === 'PUT' ? { defaultCopies: 1 } : undefined)
    assert.equal(response.status, 401)
  }
  const cookie = await loginCookie(currentEnv)
  const response = await handleRequest(new Request('https://delivery.example/api/printing/settings', {
    method: 'PUT', headers: { cookie, origin: 'https://other.example', 'content-type': 'application/json' },
    body: JSON.stringify({ defaultCopies: 1 }),
  }), currentEnv)
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error.code, 'ORIGIN_NOT_ALLOWED')
})

test('authenticated printing API configures a primary station and completes a manual order job', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)

  const empty = await handleRequest(new Request('https://delivery.example/api/printing/stations', { headers: { cookie } }), currentEnv)
  assert.equal(empty.status, 200)
  assert.deepEqual((await empty.json()).stations, [])

  const station = await jsonRequest('/api/printing/stations/station%20a', 'PUT', cookie, {
    name: 'Tablet da cozinha', platform: 'android', autoPrintEnabled: true, defaultCopies: 2,
  })
  assert.equal(station.status, 200)
  assert.equal((await station.json()).station.id, 'station a')

  const primary = await jsonRequest('/api/printing/stations/station%20a/make-primary', 'POST', cookie)
  assert.equal(primary.status, 200)
  assert.equal((await primary.json()).station.isPrimary, true)

  const manual = await jsonRequest('/api/orders/o1/print-jobs', 'POST', cookie, { copies: 2 })
  assert.equal(manual.status, 201)
  const job = (await manual.json()).job
  assert.equal(job.trigger, 'manual')
  assert.equal(job.status, 'pending')
  assert.equal(job.document.customer.phone, '(11) 99876-5432')

  const claimed = await jsonRequest(`/api/printing/jobs/${job.id}/claim`, 'POST', cookie, { stationId: 'station a' })
  assert.equal(claimed.status, 200)
  assert.equal((await claimed.json()).job.status, 'processing')

  const completed = await jsonRequest(`/api/printing/jobs/${job.id}/complete`, 'POST', cookie, { stationId: 'station a', copiesPrinted: 2 })
  assert.equal(completed.status, 200)
  assert.equal((await completed.json()).job.status, 'printed')

  const jobs = await handleRequest(new Request('https://delivery.example/api/printing/jobs?orderId=o1&limit=20', { headers: { cookie } }), currentEnv)
  assert.equal(jobs.status, 200)
  assert.equal((await jobs.json()).jobs[0].status, 'printed')

  const document = await handleRequest(new Request('https://delivery.example/api/orders/o1/print-document', { headers: { cookie } }), currentEnv)
  assert.equal(document.status, 200)
  assert.equal((await document.json()).document.order.id, 'o1')
})

test('HTTP manual lifecycle preserves a future automatic job unchanged', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  const future = new Date(Date.now() + 5 * 60 * 1000)
  const createdAt = new Date().toISOString()
  const automaticId = 'future-auto-http'

  await jsonRequest('/api/printing/stations/primary', 'PUT', cookie, {
    name: 'Cozinha', platform: 'windows', autoPrintEnabled: true, defaultCopies: 2,
  })
  await jsonRequest('/api/printing/stations/primary/make-primary', 'POST', cookie)
  currentEnv.DB.sqlite.prepare(`INSERT INTO print_jobs (
      id, business_id, order_id, type, trigger, status, copies_requested, copies_printed, station_id,
      snapshot_json, created_at, available_at, processing_started_at, processed_at, last_error_code, last_error_message
    ) VALUES (?, ?, ?, 'order', 'automatic', 'pending', 2, 0, NULL, ?, ?, ?, NULL, NULL, NULL, NULL)`)
    .run(automaticId, 'amor-e-sabor', 'o1', JSON.stringify({ version: 1, type: 'order', order: { id: 'o1' } }), createdAt, future.toISOString())

  const manualResponse = await jsonRequest('/api/orders/o1/print-jobs', 'POST', cookie, { copies: 2 })
  assert.equal(manualResponse.status, 201)
  const manual = (await manualResponse.json()).job
  await jsonRequest(`/api/printing/jobs/${manual.id}/claim`, 'POST', cookie, { stationId: 'primary' })
  const completed = await jsonRequest(`/api/printing/jobs/${manual.id}/complete`, 'POST', cookie, { stationId: 'primary', copiesPrinted: 2 })
  assert.equal((await completed.json()).job.status, 'printed')

  const jobsResponse = await handleRequest(new Request('https://delivery.example/api/printing/jobs?orderId=o1&limit=20', { headers: { cookie } }), currentEnv)
  const jobs = (await jobsResponse.json()).jobs
  const automatic = jobs.find((job) => job.id === automaticId)
  assert.notEqual(manual.id, automatic.id)
  assert.equal(jobs.some((job) => job.id === manual.id), true)
  assert.equal(automatic.status, 'pending')
  assert.equal(automatic.availableAt, future.toISOString())

  const claimAt = async (at) => {
    const SystemDate = Date
    globalThis.Date = class extends SystemDate {
      constructor(...args) { super(...(args.length ? args : [at])) }
      static now() { return at.getTime() }
    }
    try {
      return await jsonRequest('/api/printing/jobs/claim-next', 'POST', cookie, { stationId: 'primary' })
    } finally {
      globalThis.Date = SystemDate
    }
  }

  const before = new Date(future.getTime() - 1)
  const earlyClaim = await claimAt(before)
  assert.equal(earlyClaim.status, 200)
  assert.equal((await earlyClaim.json()).job, null)

  const exactClaim = await claimAt(future)
  assert.equal(exactClaim.status, 200)
  assert.equal((await exactClaim.json()).job?.id, automaticId)
})

test('claim-next rejects a secondary station and accepts only the primary automatic station', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  for (const id of ['primary', 'secondary']) {
    const response = await jsonRequest(`/api/printing/stations/${id}`, 'PUT', cookie, {
      name: id, platform: 'windows', autoPrintEnabled: true, defaultCopies: 2,
    })
    assert.equal(response.status, 200)
  }
  await jsonRequest('/api/printing/stations/primary/make-primary', 'POST', cookie)
  currentEnv.DB.sqlite.prepare(`INSERT INTO print_jobs (
      id, business_id, order_id, type, trigger, status, copies_requested, copies_printed, station_id,
      snapshot_json, created_at, available_at, processing_started_at, processed_at, last_error_code, last_error_message
    ) VALUES (?, ?, ?, 'order', 'automatic', 'pending', 2, 0, NULL, ?, ?, ?, NULL, NULL, NULL, NULL)`)
    .run('auto-1', 'amor-e-sabor', 'o1', JSON.stringify({ version: 1, type: 'order', order: { id: 'o1' } }), new Date().toISOString(), new Date().toISOString())

  const rejected = await jsonRequest('/api/printing/jobs/claim-next', 'POST', cookie, { stationId: 'secondary' })
  assert.equal(rejected.status, 409)
  assert.equal((await rejected.json()).error.code, 'PRINT_STATION_NOT_PRIMARY')

  const claimed = await jsonRequest('/api/printing/jobs/claim-next', 'POST', cookie, { stationId: 'primary' })
  assert.equal(claimed.status, 200)
  assert.equal((await claimed.json()).job.id, 'auto-1')
})

test('uncertain failure requires attention and retry preserves the same job id and snapshot', async () => {
  currentEnv = await makeEnv()
  const cookie = await loginCookie(currentEnv)
  await jsonRequest('/api/printing/stations/s1', 'PUT', cookie, {
    name: 'PC', platform: 'windows', autoPrintEnabled: false, defaultCopies: 1,
  })
  const manual = await jsonRequest('/api/orders/o1/print-jobs', 'POST', cookie, { copies: 1 })
  const original = (await manual.json()).job
  await jsonRequest(`/api/printing/jobs/${original.id}/claim`, 'POST', cookie, { stationId: 's1' })

  const failed = await jsonRequest(`/api/printing/jobs/${original.id}/fail`, 'POST', cookie, {
    stationId: 's1', code: 'SERIAL_WRITE_UNCERTAIN', message: 'queda durante escrita', uncertain: true,
  })
  assert.equal(failed.status, 200)
  assert.equal((await failed.json()).job.status, 'requires_attention')

  const retried = await jsonRequest(`/api/printing/jobs/${original.id}/retry`, 'POST', cookie, { stationId: 's1' })
  assert.equal(retried.status, 200)
  const retryJob = (await retried.json()).job
  assert.equal(retryJob.id, original.id)
  assert.deepEqual(retryJob.document, original.document)
  assert.equal(retryJob.status, 'pending')
})

test('printing endpoints require authentication and never expose another business jobs', async () => {
  currentEnv = await makeEnv()
  const unauthorized = await handleRequest(new Request('https://delivery.example/api/printing/stations'), currentEnv)
  assert.equal(unauthorized.status, 401)

  const cookie = await loginCookie(currentEnv)
  currentEnv.DB.sqlite.prepare(`INSERT INTO print_jobs (
      id, business_id, order_id, type, trigger, status, copies_requested, copies_printed, station_id,
      snapshot_json, created_at, available_at, processing_started_at, processed_at, last_error_code, last_error_message
    ) VALUES (?, ?, NULL, 'test', 'manual', 'pending', 1, 0, NULL, ?, ?, ?, NULL, NULL, NULL, NULL)`)
    .run('other-job', 'other-business', JSON.stringify({ version: 1, type: 'test' }), new Date().toISOString(), new Date().toISOString())
  const response = await handleRequest(new Request('https://delivery.example/api/printing/jobs', { headers: { cookie } }), currentEnv)
  const jobs = (await response.json()).jobs
  assert.equal(jobs.some((job) => job.id === 'other-job'), false)
})
