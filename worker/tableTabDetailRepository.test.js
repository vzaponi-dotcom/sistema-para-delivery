import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { loadOpenTableTabDetail } from './tableTabDetailRepository.js'

const openedAt = '2026-09-10T18:00:00.000Z'

// Execute the repository SQL, including its joins and filters, against real SQLite.
const createDb = (t) => {
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  sqlite.exec(`
    CREATE TABLE businesses (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE tables (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL);
    CREATE TABLE table_tabs (
      id TEXT PRIMARY KEY, business_id TEXT NOT NULL, table_id TEXT,
      tab_number INTEGER NOT NULL, status TEXT NOT NULL, opened_at TEXT NOT NULL
    );
    CREATE TABLE orders (
      id TEXT PRIMARY KEY, business_id TEXT NOT NULL, table_tab_id TEXT,
      status TEXT NOT NULL, total_cents INTEGER NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE order_items (
      id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT NOT NULL,
      product_id TEXT, name_snapshot TEXT NOT NULL, size_snapshot TEXT NOT NULL,
      quantity INTEGER NOT NULL, unit_price_cents INTEGER NOT NULL,
      price_reason TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE payments (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT NOT NULL);
    CREATE TABLE print_jobs (id TEXT PRIMARY KEY);
    INSERT INTO businesses VALUES ('biz-a', 'Restaurante A'), ('biz-b', 'Restaurante B');
    INSERT INTO tables VALUES ('table-1', 'biz-a', 'Mesa 1'), ('table-2', 'biz-a', 'Varanda'), ('table-b', 'biz-b', 'Mesa B');
    INSERT INTO table_tabs VALUES
      ('tab-1', 'biz-a', 'table-1', 1042, 'open', '${openedAt}'),
      ('tab-closed', 'biz-a', 'table-2', 1041, 'closed', '${openedAt}'),
      ('tab-b', 'biz-b', 'table-b', 1042, 'open', '${openedAt}');
  `)
  return {
    sqlite,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() { return sqlite.prepare(sql).get(...values) ?? null },
            async all() { return { results: sqlite.prepare(sql).all(...values) } },
          }
        },
      }
    },
  }
}

const addOrder = (db, {
  id = 'order-1', businessId = 'biz-a', tabId = 'tab-1',
  status = 'Em preparo', total = 2200, createdAt = openedAt,
} = {}) => db.sqlite.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?)')
  .run(id, businessId, tabId, status, total, createdAt)

const addItem = (db, {
  id = 'item-1', businessId = 'biz-a', orderId = 'order-1', productId = 'burger',
  name = 'X-Bacon', presentation = '', quantity = 1, price = 2200,
  reason = '', note = '', createdAt = openedAt,
} = {}) => db.sqlite.prepare('INSERT INTO order_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(id, businessId, orderId, productId, name, presentation, quantity, price, reason, note, createdAt)

// Commit a competing write after a real SQL result is materialized, before the
// caller can issue another read. This models the async D1 request boundary.
const interleaveAfterRead = (db, commit, methods = ['first', 'all']) => {
  let committed = false
  return {
    prepare(sql) {
      return {
        bind(...values) {
          const statement = db.prepare(sql).bind(...values)
          return Object.fromEntries(['first', 'all'].map((method) => [method, async () => {
            const result = await statement[method]()
            if (!committed && methods.includes(method)) {
              committed = true
              db.sqlite.exec('BEGIN')
              try {
                commit()
                db.sqlite.exec('COMMIT')
              } catch (error) {
                db.sqlite.exec('ROLLBACK')
                throw error
              }
            }
            return result
          }]))
        },
      }
    },
  }
}

test('detail cannot mix an empty order snapshot with concurrently committed items', async (t) => {
  const db = createDb(t)
  const racingDb = interleaveAfterRead(db, () => {
    addOrder(db, { total: 1800 })
    addItem(db)
  }, ['all'])

  const detail = await loadOpenTableTabDetail(racingDb, 'biz-a', 'tab-1')
  assert.deepEqual(detail, {
    id: 'tab-1', number: 1042, status: 'open', openedAt, businessName: 'Restaurante A',
    table: { id: 'table-1', name: 'Mesa 1' }, orderCount: 0, itemCount: 0, totalCents: 0, items: [],
  })
  // A fresh request sees the entire committed order, including its discounted total.
  assert.deepEqual(await loadOpenTableTabDetail(db, 'biz-a', 'tab-1'), {
    ...detail, orderCount: 1, itemCount: 1, totalCents: 1800,
    items: [{ productId: 'burger', name: 'X-Bacon', presentation: '', note: '',
      unitPriceCents: 2200, quantity: 1, lineTotalCents: 2200 }],
  })
})

for (const settlement of ['payment', 'cancellation']) {
  test(`detail keeps eligibility and pending content coherent during concurrent ${settlement}`, async (t) => {
    const db = createDb(t)
    addOrder(db, { total: 1800 })
    addItem(db)
    const racingDb = interleaveAfterRead(db, () => {
      if (settlement === 'payment') {
        db.sqlite.exec("INSERT INTO payments VALUES ('payment', 'biz-a', 'order-1')")
      } else {
        db.sqlite.exec("UPDATE orders SET status = 'Cancelado' WHERE id = 'order-1'")
      }
      db.sqlite.exec("UPDATE table_tabs SET status = 'closed' WHERE id = 'tab-1'")
    })

    assert.deepEqual(await loadOpenTableTabDetail(racingDb, 'biz-a', 'tab-1'), {
      id: 'tab-1', number: 1042, status: 'open', openedAt, businessName: 'Restaurante A',
      table: { id: 'table-1', name: 'Mesa 1' }, orderCount: 1, itemCount: 1, totalCents: 1800,
      items: [{ productId: 'burger', name: 'X-Bacon', presentation: '', note: '',
        unitPriceCents: 2200, quantity: 1, lineTotalCents: 2200 }],
    })
    assert.equal(await loadOpenTableTabDetail(db, 'biz-a', 'tab-1'), null)
  })
}

test('detail counts each payable order once despite multiple lines, equal totals or no items', async (t) => {
  const db = createDb(t)
  addOrder(db, { total: 4000 })
  addOrder(db, { id: 'order-2', total: 4000 })
  addOrder(db, { id: 'order-empty', total: 500 })
  addItem(db)
  addItem(db, { id: 'item-2', note: 'Sem cebola' })
  addItem(db, { id: 'item-3', orderId: 'order-2' })
  const detail = await loadOpenTableTabDetail(db, 'biz-a', 'tab-1')
  assert.equal(detail.orderCount, 3)
  assert.equal(detail.totalCents, 8500)
  assert.equal(detail.itemCount, 3)
  assert.deepEqual(detail.items, [
    { productId: 'burger', name: 'X-Bacon', presentation: '', note: '', unitPriceCents: 2200, quantity: 2, lineTotalCents: 4400 },
    { productId: 'burger', name: 'X-Bacon', presentation: '', note: 'Sem cebola', unitPriceCents: 2200, quantity: 1, lineTotalCents: 2200 },
  ])
})

test('open tab with only paid or cancelled orders returns an empty pending detail', async (t) => {
  const db = createDb(t)
  addOrder(db)
  addItem(db)
  addOrder(db, { id: 'cancelled', status: 'Cancelado' })
  addItem(db, { id: 'cancelled-item', orderId: 'cancelled' })
  db.sqlite.exec("INSERT INTO payments VALUES ('payment', 'biz-a', 'order-1')")
  assert.deepEqual(await loadOpenTableTabDetail(db, 'biz-a', 'tab-1'), {
    id: 'tab-1', number: 1042, status: 'open', openedAt, businessName: 'Restaurante A',
    table: { id: 'table-1', name: 'Mesa 1' }, orderCount: 0, itemCount: 0, totalCents: 0, items: [],
  })
})

test('detail consolidates quantities across pending orders and uses payable order totals', async (t) => {
  const db = createDb(t)
  addOrder(db, { total: 4000 }) // Discounted order: payable total differs from its lines.
  addOrder(db, { id: 'order-2', status: 'Finalizado', total: 6600 })
  addItem(db, { quantity: 2 })
  addItem(db, { id: 'item-2', orderId: 'order-2', quantity: 3 })

  assert.deepEqual(await loadOpenTableTabDetail(db, 'biz-a', 'tab-1'), {
    id: 'tab-1', number: 1042, status: 'open', openedAt,
    businessName: 'Restaurante A', table: { id: 'table-1', name: 'Mesa 1' },
    orderCount: 2, itemCount: 5, totalCents: 10600,
    items: [{ productId: 'burger', name: 'X-Bacon', presentation: '', note: '',
      unitPriceCents: 2200, quantity: 5, lineTotalCents: 11000 }],
  })
})

// Each case catches removing exactly one independent grouping boundary.
for (const [boundary, change, expected] of [
  ['product identity', { productId: 'other-burger' }, { productId: 'other-burger' }],
  ['historical name', { name: 'X-Bacon especial' }, { name: 'X-Bacon especial' }],
  ['presentation/options', { presentation: 'Grande' }, { presentation: 'Grande' }],
  ['unit price', { price: 2300 }, { unitPriceCents: 2300, lineTotalCents: 2300 }],
  ['note', { note: 'Sem cebola' }, { note: 'Sem cebola' }],
  ['price reason', { reason: 'Promoção' }, {}],
]) {
  test(`detail keeps different ${boundary} separate`, async (t) => {
    const db = createDb(t)
    addOrder(db, { total: 4400 })
    addItem(db)
    addItem(db, { id: 'item-2', ...change })
    const base = { productId: 'burger', name: 'X-Bacon', presentation: '', note: '',
      unitPriceCents: 2200, quantity: 1, lineTotalCents: 2200 }

    const detail = await loadOpenTableTabDetail(db, 'biz-a', 'tab-1')
    assert.deepEqual(detail.items, [base, { ...base, ...expected }])
    assert.equal(detail.itemCount, 2)
  })
}

test('detail normalizes note whitespace and groups deleted-product snapshots by name', async (t) => {
  const db = createDb(t)
  addOrder(db, { total: 8800 })
  addItem(db, { productId: null, note: '  Sem\n  cebola ' })
  addItem(db, { id: 'item-2', productId: null, note: 'Sem cebola', quantity: 2 })
  addItem(db, { id: 'item-3', productId: null, name: 'X-Salada', note: 'Sem cebola' })

  assert.deepEqual((await loadOpenTableTabDetail(db, 'biz-a', 'tab-1')).items, [
    { productId: '', name: 'X-Bacon', presentation: '', note: 'Sem cebola', unitPriceCents: 2200, quantity: 3, lineTotalCents: 6600 },
    { productId: '', name: 'X-Salada', presentation: '', note: 'Sem cebola', unitPriceCents: 2200, quantity: 1, lineTotalCents: 2200 },
  ])
})

test('detail excludes cancelled, paid, other-tab and other-business orders and foreign items', async (t) => {
  const db = createDb(t)
  addOrder(db)
  addItem(db)
  for (const [id, overrides] of [
    ['cancelled', { status: 'Cancelado' }],
    ['paid', { status: 'Finalizado' }],
    ['other-tab', { tabId: 'tab-closed' }],
    ['foreign', { businessId: 'biz-b' }],
  ]) {
    addOrder(db, { id, ...overrides })
    addItem(db, { id, orderId: id, productId: `${id}-product`, businessId: overrides.businessId || 'biz-a' })
  }
  addItem(db, { id: 'foreign-item', businessId: 'biz-b', productId: 'foreign-item' })
  db.sqlite.exec(`INSERT INTO payments VALUES
    ('payment', 'biz-a', 'paid'),
    ('foreign-payment', 'biz-b', 'order-1');`)

  const detail = await loadOpenTableTabDetail(db, 'biz-a', 'tab-1')
  assert.deepEqual(detail.items, [{ productId: 'burger', name: 'X-Bacon', presentation: '', note: '',
    unitPriceCents: 2200, quantity: 1, lineTotalCents: 2200 }])
  assert.equal(detail.orderCount, 1)
  assert.equal(detail.itemCount, 1)
  assert.equal(detail.totalCents, 2200)
})

test('detail returns null for missing, closed, foreign tabs or a foreign table association', async (t) => {
  const db = createDb(t)
  assert.equal(await loadOpenTableTabDetail(db, 'biz-a', 'missing'), null)
  assert.equal(await loadOpenTableTabDetail(db, 'biz-a', 'tab-closed'), null)
  assert.equal(await loadOpenTableTabDetail(db, 'biz-b', 'tab-1'), null)
  db.sqlite.exec("UPDATE table_tabs SET table_id = 'table-b' WHERE id = 'tab-1'")
  assert.equal(await loadOpenTableTabDetail(db, 'biz-a', 'tab-1'), null)
})

test('empty and transferred tabs preserve their business number and repeated reads do not write', async (t) => {
  const db = createDb(t)
  db.sqlite.exec("UPDATE table_tabs SET table_id = 'table-2' WHERE id = 'tab-1'")
  const changesBefore = db.sqlite.prepare('SELECT total_changes() AS count').get().count
  const detail = await loadOpenTableTabDetail(db, 'biz-a', 'tab-1')
  assert.deepEqual(detail, {
    id: 'tab-1', number: 1042, status: 'open', openedAt, businessName: 'Restaurante A',
    table: { id: 'table-2', name: 'Varanda' }, orderCount: 0, itemCount: 0, totalCents: 0, items: [],
  })
  assert.deepEqual(await loadOpenTableTabDetail(db, 'biz-a', 'tab-1'), detail)
  assert.equal((await loadOpenTableTabDetail(db, 'biz-b', 'tab-b')).number, 1042)
  assert.equal(db.sqlite.prepare('SELECT total_changes() AS count').get().count, changesBefore)
  assert.equal(db.sqlite.prepare('SELECT count(*) AS count FROM print_jobs').get().count, 0)
})

test('detail orders groups by order time/id then item time/id, independent of insertion order', async (t) => {
  const db = createDb(t)
  addOrder(db, { id: 'order-z' })
  addOrder(db, { id: 'order-b' })
  addOrder(db, { id: 'order-a', createdAt: '2026-09-10T19:00:00.000Z' })
  addItem(db, { id: 'z', orderId: 'order-z', name: 'Third' })
  addItem(db, { id: 'late', orderId: 'order-b', name: 'Second', createdAt: '2026-09-10T19:00:00.000Z' })
  addItem(db, { id: 'b', orderId: 'order-b', name: 'First B' })
  addItem(db, { id: 'a', orderId: 'order-b', name: 'First A' })
  addItem(db, { id: 'last', orderId: 'order-a', name: 'Last' })
  assert.deepEqual((await loadOpenTableTabDetail(db, 'biz-a', 'tab-1')).items.map((item) => item.name),
    ['First A', 'First B', 'Second', 'Third', 'Last'])
})
