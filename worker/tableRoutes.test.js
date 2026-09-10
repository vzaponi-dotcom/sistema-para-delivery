import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { hashPin } from './auth.js'
import { handleRequest } from './index.js'

class D1Sqlite {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:')
    this.sqlite.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE businesses (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE auth_credentials (business_id TEXT PRIMARY KEY, pin_hash TEXT NOT NULL);
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        revoked_at TEXT
      );
      CREATE TABLE tables (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        name TEXT NOT NULL,
        name_key TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        is_active INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX idx_tables_business_name_key ON tables (business_id, name_key);
      CREATE TABLE table_tabs (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        table_id TEXT,
        table_identifier TEXT NOT NULL,
        tab_number INTEGER,
        status TEXT NOT NULL,
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX idx_table_tabs_one_open_per_table_id
        ON table_tabs (business_id, table_id) WHERE status = 'open';
      CREATE UNIQUE INDEX idx_table_tabs_business_number
        ON table_tabs (business_id, tab_number);
      CREATE TABLE table_tab_counters (
        business_id TEXT PRIMARY KEY REFERENCES businesses(id),
        last_number INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE orders (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, table_tab_id TEXT, status TEXT NOT NULL, total_cents INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE payments (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT NOT NULL);
      CREATE TABLE order_items (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT NOT NULL, quantity INTEGER NOT NULL);
      INSERT INTO businesses (id, name) VALUES ('amor-e-sabor', 'Amor & Sabor');
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
}

const makeAuthenticatedEnv = async () => {
  const db = new D1Sqlite()
  db.sqlite.prepare('INSERT INTO auth_credentials (business_id, pin_hash) VALUES (?, ?)')
    .run('amor-e-sabor', await hashPin('4827', new Uint8Array(16).fill(7)))
  const env = {
    DB: db,
    LOGIN_RATE_LIMITER: { limit: async () => ({ success: true }) },
    ASSETS: { fetch: async () => new Response('asset') },
  }
  const response = await handleRequest(new Request('https://delivery.example/api/auth/login', {
    method: 'POST',
    headers: { origin: 'https://delivery.example', 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '4827' }),
  }), env)
  return { env, cookie: response.headers.get('set-cookie').split(';')[0] }
}

const mutation = (env, cookie, method, path, body, withOrigin = true) => handleRequest(new Request(
  `https://delivery.example${path}`,
  {
    method,
    headers: {
      ...(withOrigin ? { origin: 'https://delivery.example' } : {}),
      ...(cookie ? { cookie } : {}),
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  },
), env)

const insertTable = (db, { id, name, sortOrder, isActive = 1 }) => {
  const timestamp = '2026-09-07T15:00:00.000Z'
  db.sqlite.prepare(`INSERT INTO tables (
    id, business_id, name, name_key, sort_order, is_active, created_at, updated_at
  ) VALUES (?, 'amor-e-sabor', ?, ?, ?, ?, ?, ?)`).run(
    id, name, name.toUpperCase(), sortOrder, isActive, timestamp, timestamp,
  )
}

test('authenticated table routes create, rename, activate, and reorder using official table lists', async () => {
  const { env, cookie } = await makeAuthenticatedEnv()
  insertTable(env.DB, { id: 'table-1', name: 'Mesa 1', sortOrder: 1 })

  const createdResponse = await mutation(env, cookie, 'POST', '/api/tables', { name: 'Varanda' })
  assert.equal(createdResponse.status, 201)
  const createdTables = (await createdResponse.json()).tables
  const created = createdTables.find((table) => table.name === 'Varanda')
  assert.equal(created.occupancy, 'free')

  const renamedResponse = await mutation(env, cookie, 'PATCH', `/api/tables/${created.id}`, { name: 'Salão' })
  assert.equal((await renamedResponse.json()).tables.find((table) => table.id === created.id).name, 'Salão')

  const inactiveResponse = await mutation(env, cookie, 'PATCH', `/api/tables/${created.id}`, { isActive: false })
  assert.equal((await inactiveResponse.json()).tables.find((table) => table.id === created.id).isActive, false)

  const orderedResponse = await mutation(env, cookie, 'PUT', '/api/tables/order', { tableIds: [created.id, 'table-1'] })
  assert.deepEqual((await orderedResponse.json()).tables.map((table) => table.id), [created.id, 'table-1'])
})

test('table PATCH rejects ambiguous and unexpected payloads', async () => {
  const { env, cookie } = await makeAuthenticatedEnv()
  insertTable(env.DB, { id: 'table-1', name: 'Mesa 1', sortOrder: 1 })

  for (const body of [{ name: 'Varanda', isActive: false }, { color: 'red' }, { name: 'Varanda', color: 'red' }]) {
    const response = await mutation(env, cookie, 'PATCH', '/api/tables/table-1', body)
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error.code, 'INVALID_TABLE_PATCH')
  }
})

test('authenticated transfer route returns the official tables and transferred tab', async () => {
  const { env, cookie } = await makeAuthenticatedEnv()
  insertTable(env.DB, { id: 'source', name: 'Mesa 1', sortOrder: 1 })
  insertTable(env.DB, { id: 'destination', name: 'Mesa 2', sortOrder: 2 })
  const timestamp = '2026-09-07T15:00:00.000Z'
  env.DB.sqlite.prepare(`INSERT INTO table_tabs (
    id, business_id, table_id, table_identifier, tab_number, status, opened_at, created_at, updated_at
  ) VALUES ('tab-1', 'amor-e-sabor', 'source', 'Mesa 1', 37, 'open', ?, ?, ?)`).run(timestamp, timestamp, timestamp)

  const response = await mutation(env, cookie, 'POST', '/api/tables/source/transfer', { destinationTableId: 'destination' })
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.tableTab.id, 'tab-1')
  assert.equal(payload.tableTab.tableId, 'destination')
  assert.equal(payload.tableTab.tabNumber, 37)
  assert.deepEqual(payload.tables.map(({ id, occupancy }) => [id, occupancy]), [
    ['source', 'free'],
    ['destination', 'occupied'],
  ])
})

test('every table mutation requires a session and a same-origin request', async () => {
  const { env, cookie } = await makeAuthenticatedEnv()
  const requests = [
    ['POST', '/api/tables', { name: 'Mesa 1' }],
    ['PATCH', '/api/tables/table-1', { name: 'Varanda' }],
    ['PUT', '/api/tables/order', { tableIds: [] }],
    ['POST', '/api/tables/table-1/transfer', { destinationTableId: 'table-2' }],
  ]

  for (const [method, path, body] of requests) {
    const unauthenticated = await mutation(env, null, method, path, body)
    assert.equal(unauthenticated.status, 401)
    assert.equal((await unauthenticated.json()).error.code, 'UNAUTHENTICATED')

    const crossOrigin = await mutation(env, cookie, method, path, body, false)
    assert.equal(crossOrigin.status, 403)
    assert.equal((await crossOrigin.json()).error.code, 'ORIGIN_NOT_ALLOWED')
  }
})
