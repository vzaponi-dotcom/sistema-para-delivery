import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import * as tableRepository from './tableRepository.js'

const {
  createTable,
  getOrCreateOpenTableTabByTableId,
  listTables,
  loadTableById,
  normalizeTableName,
  renameTable,
  reorderTables,
  setTableActive,
  transferOpenTableTab,
} = tableRepository

class D1Sqlite {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:')
    this.sqlite.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE businesses (id TEXT PRIMARY KEY);
      CREATE TABLE tables (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id),
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
        table_id TEXT REFERENCES tables(id),
        table_identifier TEXT NOT NULL,
        status TEXT NOT NULL,
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX idx_table_tabs_one_open_per_table_id
        ON table_tabs (business_id, table_id) WHERE status = 'open';
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        table_tab_id TEXT REFERENCES table_tabs(id)
      );
      INSERT INTO businesses (id) VALUES ('biz-a'), ('biz-b');
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

  exec(sql) {
    this.sqlite.exec(sql)
  }
}

const now = new Date('2026-09-07T15:00:00.000Z')

const insertTable = (db, { id, businessId = 'biz-a', name, nameKey = name.toUpperCase(), sortOrder, isActive = 1 }) => {
  db.sqlite.prepare(`INSERT INTO tables (
    id, business_id, name, name_key, sort_order, is_active, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id,
    businessId,
    name,
    nameKey,
    sortOrder,
    isActive,
    now.toISOString(),
    now.toISOString(),
  )
}

const insertOpenTableTab = (db, { id, tableId, businessId = 'biz-a', tableIdentifier }) => {
  db.sqlite.prepare(`INSERT INTO table_tabs (
    id, business_id, table_id, table_identifier, status, opened_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, 'open', ?, ?, ?)`).run(
    id,
    businessId,
    tableId,
    tableIdentifier,
    now.toISOString(),
    now.toISOString(),
    now.toISOString(),
  )
}

test('normalizeTableName collapses spaces, builds a case-insensitive key, and enforces its limit', () => {
  assert.deepEqual(normalizeTableName('  Mesa   8  '), { name: 'Mesa 8', nameKey: 'MESA 8' })
  assert.throws(() => normalizeTableName('   '), (error) => error.status === 400 && error.code === 'VALIDATION_ERROR')
  assert.deepEqual(normalizeTableName('x'.repeat(60)), { name: 'x'.repeat(60), nameKey: 'X'.repeat(60) })
  assert.throws(() => normalizeTableName('x'.repeat(61)), (error) => error.status === 400 && error.code === 'VALIDATION_ERROR')
})

test('listTables orders tables and derives occupancy from an open table tab', async () => {
  const db = new D1Sqlite()
  insertTable(db, { id: 'second', name: 'Mesa 2', sortOrder: 2, isActive: 0 })
  insertTable(db, { id: 'first', name: 'Mesa 1', sortOrder: 1 })
  db.exec(`INSERT INTO table_tabs (
    id, business_id, table_id, table_identifier, status, opened_at, created_at, updated_at
  ) VALUES ('tab-1', 'biz-a', 'first', 'Mesa 1', 'open', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}')`)

  assert.deepEqual(await listTables(db, 'biz-a'), [
    { id: 'first', name: 'Mesa 1', sortOrder: 1, isActive: true, occupancy: 'occupied', openTableTabId: 'tab-1' },
    { id: 'second', name: 'Mesa 2', sortOrder: 2, isActive: false, occupancy: 'free', openTableTabId: null },
  ])
})

test('createTable normalizes the name and appends after the current business order', async () => {
  const db = new D1Sqlite()
  insertTable(db, { id: 'existing', name: 'Mesa 1', sortOrder: 4 })
  insertTable(db, { id: 'other', businessId: 'biz-b', name: 'Mesa 9', sortOrder: 30 })

  const created = await createTable(db, 'biz-a', { name: '  Jardim   1 ' }, now)

  assert.equal(created.name, 'Jardim 1')
  assert.equal(created.sortOrder, 5)
  assert.equal(created.isActive, true)
  assert.equal(created.occupancy, 'free')
  assert.equal((await loadTableById(db, 'biz-a', created.id)).name, 'Jardim 1')
  assert.equal(await loadTableById(db, 'biz-b', created.id), null)
})

test('renameTable changes a free table and hides normalized uniqueness errors', async () => {
  const db = new D1Sqlite()
  insertTable(db, { id: 'one', name: 'Mesa 1', sortOrder: 1 })
  insertTable(db, { id: 'two', name: 'Mesa 2', sortOrder: 2 })

  assert.equal((await renameTable(db, 'biz-a', 'one', '  Varanda   A  ', now)).name, 'Varanda A')
  await assert.rejects(
    () => renameTable(db, 'biz-a', 'one', ' mesa   2 ', now),
    (error) => error.status === 409 && error.code === 'TABLE_NAME_EXISTS' && !/UNIQUE constraint/i.test(error.message),
  )
})

test('occupied tables cannot be renamed or deactivated', async () => {
  const db = new D1Sqlite()
  insertTable(db, { id: 'occupied', name: 'Mesa 1', sortOrder: 1 })
  db.exec(`INSERT INTO table_tabs (
    id, business_id, table_id, table_identifier, status, opened_at, created_at, updated_at
  ) VALUES ('tab-open', 'biz-a', 'occupied', 'Mesa 1', 'open', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}')`)

  await assert.rejects(
    () => renameTable(db, 'biz-a', 'occupied', 'Novo nome', now),
    (error) => error.status === 409 && error.code === 'TABLE_OCCUPIED',
  )
  await assert.rejects(
    () => setTableActive(db, 'biz-a', 'occupied', false, now),
    (error) => error.status === 409 && error.code === 'TABLE_OCCUPIED',
  )
})

test('a free table can be deactivated and later reactivated', async () => {
  const db = new D1Sqlite()
  insertTable(db, { id: 'free', name: 'Mesa 1', sortOrder: 1 })

  assert.equal((await setTableActive(db, 'biz-a', 'free', false, now)).isActive, false)
  assert.equal((await setTableActive(db, 'biz-a', 'free', true, now)).isActive, true)
})

test('reorderTables accepts every business table exactly once and never updates another business', async () => {
  const db = new D1Sqlite()
  insertTable(db, { id: 'one', name: 'Mesa 1', sortOrder: 1 })
  insertTable(db, { id: 'two', name: 'Mesa 2', sortOrder: 2 })
  insertTable(db, { id: 'other', businessId: 'biz-b', name: 'Mesa 1', sortOrder: 7 })

  assert.deepEqual((await reorderTables(db, 'biz-a', ['two', 'one'], now)).map((table) => table.id), ['two', 'one'])
  assert.equal((await loadTableById(db, 'biz-b', 'other')).sortOrder, 7)
  await assert.rejects(() => reorderTables(db, 'biz-a', ['one', 'one'], now), (error) => error.code === 'INVALID_TABLE_ORDER')
  await assert.rejects(() => reorderTables(db, 'biz-a', ['one'], now), (error) => error.code === 'INVALID_TABLE_ORDER')
  await assert.rejects(() => reorderTables(db, 'biz-a', ['one', 'other'], now), (error) => error.code === 'INVALID_TABLE_ORDER')
})

test('table repository exposes no hard-delete operation', () => {
  assert.equal(Object.hasOwn(tableRepository, 'deleteTable'), false)
})

test('active table opens one tab with the exact table name snapshot and reuses it', async () => {
  const db = new D1Sqlite()
  insertTable(db, { id: 'table-1', name: 'Varanda', sortOrder: 1 })

  const first = await getOrCreateOpenTableTabByTableId(db, 'biz-a', 'table-1', now)
  const second = await getOrCreateOpenTableTabByTableId(db, 'biz-a', 'table-1', new Date('2026-09-07T15:01:00.000Z'))

  assert.equal(first.id, second.id)
  assert.equal(first.tableId, 'table-1')
  assert.equal(first.tableIdentifier, 'Varanda')
  assert.equal(db.sqlite.prepare("SELECT count(*) AS count FROM table_tabs WHERE status = 'open'").get().count, 1)
})

test('missing, cross-business, and inactive tables are rejected by the domain', async () => {
  const db = new D1Sqlite()
  insertTable(db, { id: 'inactive', name: 'Mesa 1', sortOrder: 1, isActive: 0 })
  insertTable(db, { id: 'other', businessId: 'biz-b', name: 'Mesa 2', sortOrder: 1 })

  for (const tableId of ['missing', 'other']) {
    await assert.rejects(
      () => getOrCreateOpenTableTabByTableId(db, 'biz-a', tableId, now),
      (error) => error.status === 404 && error.code === 'TABLE_NOT_FOUND',
    )
  }
  await assert.rejects(
    () => getOrCreateOpenTableTabByTableId(db, 'biz-a', 'inactive', now),
    (error) => error.status === 409 && error.code === 'TABLE_INACTIVE',
  )
})

test('concurrent attempts cannot create two open tabs for the same table', async () => {
  const db = new D1Sqlite()
  insertTable(db, { id: 'table-1', name: 'Mesa 1', sortOrder: 1 })

  const [first, second] = await Promise.all([
    getOrCreateOpenTableTabByTableId(db, 'biz-a', 'table-1', now),
    getOrCreateOpenTableTabByTableId(db, 'biz-a', 'table-1', now),
  ])

  assert.equal(first.id, second.id)
  assert.equal(db.sqlite.prepare("SELECT count(*) AS count FROM table_tabs WHERE status = 'open'").get().count, 1)
})

test('transferOpenTableTab moves the same tab and its orders to the active free destination', async () => {
  const db = new D1Sqlite()
  insertTable(db, { id: 'source', name: 'Mesa 1', sortOrder: 1 })
  insertTable(db, { id: 'destination', name: 'Varanda', sortOrder: 2 })
  insertOpenTableTab(db, { id: 'tab-1', tableId: 'source', tableIdentifier: 'Mesa 1' })
  db.sqlite.prepare('INSERT INTO orders (id, table_tab_id) VALUES (?, ?)').run('order-1', 'tab-1')

  const transferred = await transferOpenTableTab(db, 'biz-a', 'source', 'destination', now)

  assert.deepEqual(transferred, {
    id: 'tab-1',
    tableId: 'destination',
    tableIdentifier: 'Varanda',
    status: 'open',
    openedAt: now.toISOString(),
    closedAt: null,
  })
  assert.equal(db.sqlite.prepare('SELECT table_tab_id FROM orders WHERE id = ?').get('order-1').table_tab_id, 'tab-1')
  assert.equal((await loadTableById(db, 'biz-a', 'source')).occupancy, 'free')
  assert.equal((await loadTableById(db, 'biz-a', 'destination')).occupancy, 'occupied')
})

test('transferOpenTableTab rejects a source without an open tab', async () => {
  const db = new D1Sqlite()
  insertTable(db, { id: 'source', name: 'Mesa 1', sortOrder: 1 })
  insertTable(db, { id: 'destination', name: 'Mesa 2', sortOrder: 2 })

  await assert.rejects(
    () => transferOpenTableTab(db, 'biz-a', 'source', 'destination', now),
    (error) => error.status === 409 && error.code === 'TABLE_SOURCE_FREE',
  )
})

test('transferOpenTableTab rejects a missing or cross-business destination', async () => {
  const db = new D1Sqlite()
  insertTable(db, { id: 'source', name: 'Mesa 1', sortOrder: 1 })
  insertTable(db, { id: 'other', businessId: 'biz-b', name: 'Mesa 2', sortOrder: 1 })
  insertOpenTableTab(db, { id: 'tab-1', tableId: 'source', tableIdentifier: 'Mesa 1' })

  for (const destinationId of ['missing', 'other']) {
    await assert.rejects(
      () => transferOpenTableTab(db, 'biz-a', 'source', destinationId, now),
      (error) => error.status === 404 && error.code === 'TABLE_DESTINATION_NOT_FOUND',
    )
  }
})

test('transferOpenTableTab rejects an inactive destination', async () => {
  const db = new D1Sqlite()
  insertTable(db, { id: 'source', name: 'Mesa 1', sortOrder: 1 })
  insertTable(db, { id: 'destination', name: 'Mesa 2', sortOrder: 2, isActive: 0 })
  insertOpenTableTab(db, { id: 'tab-1', tableId: 'source', tableIdentifier: 'Mesa 1' })

  await assert.rejects(
    () => transferOpenTableTab(db, 'biz-a', 'source', 'destination', now),
    (error) => error.status === 409 && error.code === 'TABLE_DESTINATION_INACTIVE',
  )
})

test('transferOpenTableTab rejects an occupied destination without merging tabs', async () => {
  const db = new D1Sqlite()
  insertTable(db, { id: 'source', name: 'Mesa 1', sortOrder: 1 })
  insertTable(db, { id: 'destination', name: 'Mesa 2', sortOrder: 2 })
  insertOpenTableTab(db, { id: 'source-tab', tableId: 'source', tableIdentifier: 'Mesa 1' })
  insertOpenTableTab(db, { id: 'destination-tab', tableId: 'destination', tableIdentifier: 'Mesa 2' })

  await assert.rejects(
    () => transferOpenTableTab(db, 'biz-a', 'source', 'destination', now),
    (error) => error.status === 409 && error.code === 'TABLE_DESTINATION_OCCUPIED',
  )
  assert.equal(db.sqlite.prepare("SELECT count(*) AS count FROM table_tabs WHERE status = 'open'").get().count, 2)
})

test('transferOpenTableTab rejects transferring a tab to its current table', async () => {
  const db = new D1Sqlite()
  insertTable(db, { id: 'source', name: 'Mesa 1', sortOrder: 1 })
  insertOpenTableTab(db, { id: 'tab-1', tableId: 'source', tableIdentifier: 'Mesa 1' })

  await assert.rejects(
    () => transferOpenTableTab(db, 'biz-a', 'source', 'source', now),
    (error) => error.status === 409 && error.code === 'TABLE_TRANSFER_SAME_TABLE',
  )
})

test('concurrent transfers to one destination cannot create two open tabs there', async () => {
  const db = new D1Sqlite()
  insertTable(db, { id: 'source-1', name: 'Mesa 1', sortOrder: 1 })
  insertTable(db, { id: 'source-2', name: 'Mesa 2', sortOrder: 2 })
  insertTable(db, { id: 'destination', name: 'Mesa 3', sortOrder: 3 })
  insertOpenTableTab(db, { id: 'tab-1', tableId: 'source-1', tableIdentifier: 'Mesa 1' })
  insertOpenTableTab(db, { id: 'tab-2', tableId: 'source-2', tableIdentifier: 'Mesa 2' })

  const results = await Promise.allSettled([
    transferOpenTableTab(db, 'biz-a', 'source-1', 'destination', now),
    transferOpenTableTab(db, 'biz-a', 'source-2', 'destination', now),
  ])

  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1)
  assert.equal(results.filter(({ status }) => status === 'rejected').length, 1)
  assert.equal(results.find(({ status }) => status === 'rejected').reason.code, 'TABLE_DESTINATION_OCCUPIED')
  assert.equal(db.sqlite.prepare(`SELECT count(*) AS count FROM table_tabs
    WHERE business_id = 'biz-a' AND table_id = 'destination' AND status = 'open'`).get().count, 1)
})
