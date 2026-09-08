import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { createOrder } from './repositories.js'

class D1Sqlite {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:')
    this.sqlite.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE businesses (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE clients (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT, address TEXT);
      CREATE TABLE products (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, category TEXT, size TEXT,
        presentation_type TEXT, presentation_value TEXT, presentation_unit TEXT,
        name TEXT NOT NULL, price_cents INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, client_id TEXT,
        client_name_snapshot TEXT NOT NULL, client_phone_snapshot TEXT NOT NULL DEFAULT '',
        client_address_snapshot TEXT NOT NULL DEFAULT '', customer_identity_type TEXT,
        table_tab_id TEXT, type TEXT NOT NULL, order_date TEXT NOT NULL, status TEXT NOT NULL,
        subtotal_cents INTEGER NOT NULL, delivery_fee_cents INTEGER NOT NULL,
        adjustment_type TEXT NOT NULL, adjustment_mode TEXT NOT NULL, adjustment_value INTEGER NOT NULL,
        adjustment_amount_cents INTEGER NOT NULL, adjustment_reason TEXT NOT NULL,
        total_cents INTEGER NOT NULL, created_at TEXT NOT NULL, finished_at TEXT,
        cancelled_at TEXT, cancel_reason TEXT, cancel_reason_note TEXT, scheduled_for TEXT, promised_payment_date TEXT, is_backdated INTEGER NOT NULL DEFAULT 0, idempotency_key TEXT NOT NULL
      );
      CREATE UNIQUE INDEX orders_idempotency_idx ON orders (business_id, idempotency_key);
      CREATE TABLE order_items (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT NOT NULL, product_id TEXT,
        name_snapshot TEXT NOT NULL, category_snapshot TEXT, size_snapshot TEXT, quantity INTEGER NOT NULL,
        catalog_price_cents INTEGER NOT NULL, unit_price_cents INTEGER NOT NULL, price_reason TEXT,
        note TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL, method TEXT NOT NULL, paid_at TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE movements (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, type TEXT, category TEXT, description TEXT,
        value_cents INTEGER, source TEXT, order_id TEXT, payment_id TEXT, payment_method TEXT,
        movement_date TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT
      );
      CREATE TABLE table_tabs (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, table_id TEXT, table_identifier TEXT NOT NULL,
        status TEXT NOT NULL, opened_at TEXT NOT NULL, closed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE tables (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL, name_key TEXT NOT NULL,
        sort_order INTEGER NOT NULL, is_active INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX idx_table_tabs_one_open_per_table_id ON table_tabs (business_id, table_id) WHERE status = 'open';
      CREATE TABLE print_stations (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL, platform TEXT NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0, auto_print_enabled INTEGER NOT NULL DEFAULT 0,
        default_copies INTEGER NOT NULL DEFAULT 2, last_seen_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX print_stations_one_primary_idx ON print_stations (business_id) WHERE is_primary = 1;
      CREATE TABLE business_print_settings (
        business_id TEXT PRIMARY KEY, default_copies INTEGER NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE print_jobs (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, order_id TEXT, type TEXT NOT NULL,
        trigger TEXT NOT NULL, status TEXT NOT NULL, copies_requested INTEGER NOT NULL,
        copies_printed INTEGER NOT NULL DEFAULT 0, station_id TEXT, snapshot_json TEXT NOT NULL,
        created_at TEXT NOT NULL, available_at TEXT NOT NULL, processing_started_at TEXT, processed_at TEXT,
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
  all(sql) { return this.sqlite.prepare(sql).all() }
}

const seed = ({ auto = true, primary = true, centralCopies = 2 } = {}) => {
  const db = new D1Sqlite()
  db.exec(`
    INSERT INTO businesses (id, name) VALUES ('amor-e-sabor', 'Amor & Sabor');
    INSERT INTO clients (id, business_id, name, phone, address)
      VALUES ('c1', 'amor-e-sabor', 'Maria', '11998765432', 'Rua das Flores, 123');
    INSERT INTO products (
      id, business_id, category, size, presentation_type, presentation_value, presentation_unit, name, price_cents, active
    ) VALUES
      ('p1', 'amor-e-sabor', 'Lanches', '', 'size', 'G', '', 'X-BURGER', 3000, 1),
      ('p2', 'amor-e-sabor', 'Bebidas', '350ml', 'volume', '350', 'ml', 'Coca-Cola', 800, 1);
    INSERT INTO print_stations (
      id, business_id, name, platform, is_primary, auto_print_enabled, default_copies, created_at, updated_at
    ) VALUES ('station-a', 'amor-e-sabor', 'Tablet da cozinha', 'android', ${primary ? 1 : 0}, ${auto ? 1 : 0}, 2,
      '2026-09-03T20:00:00.000Z', '2026-09-03T20:00:00.000Z');
    INSERT INTO business_print_settings (business_id, default_copies, created_at, updated_at)
      VALUES ('amor-e-sabor', ${centralCopies}, '2026-09-03T20:00:00.000Z', '2026-09-03T20:00:00.000Z');
    INSERT INTO tables (id, business_id, name, name_key, sort_order, is_active, created_at, updated_at)
      VALUES ('table-1', 'amor-e-sabor', 'Mesa 1', 'MESA 1', 1, 1,
        '2026-09-03T20:00:00.000Z', '2026-09-03T20:00:00.000Z');
  `)
  return db
}

const input = (overrides = {}) => ({
  customerIdentity: { type: 'registered_client', clientId: 'c1' },
  type: 'Entrega',
  orderDate: '2026-09-03',
  idempotencyKey: 'print-checkout-1',
  items: [
    { productId: 'p1', quantity: 2, note: 'sem cebola' },
    { productId: 'p2', quantity: 1, note: '' },
  ],
  deliveryFeeCents: 800,
  adjustment: { type: 'none', mode: 'fixed', storedValue: 0, reason: '' },
  paymentMethod: 'Pix',
  ...overrides,
})

test('current checkout snapshots customer contact and enqueues one paid automatic print job atomically', async () => {
  const db = seed()
  const now = new Date('2026-09-03T23:31:00.000Z')
  const order = await createOrder(db, 'amor-e-sabor', input(), now)

  assert.equal(order.clientPhone, '(11) 99876-5432')
  assert.equal(order.clientAddress, 'Rua das Flores, 123')
  const jobs = db.all(`SELECT * FROM print_jobs`)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].order_id, order.id)
  assert.equal(jobs[0].trigger, 'automatic')
  assert.equal(jobs[0].status, 'pending')
  assert.equal(jobs[0].station_id, null)
  assert.equal(jobs[0].copies_requested, 2)
  const snapshot = JSON.parse(jobs[0].snapshot_json)
  assert.equal(snapshot.customer.phone, '(11) 99876-5432')
  assert.equal(snapshot.customer.address, 'Rua das Flores, 123')
  assert.equal(snapshot.items[0].note, 'sem cebola')
  assert.deepEqual(snapshot.payment, { status: 'Pago', method: 'Pix' })
})

test('table checkout requests one automatic copy when the central default is two', async () => {
  const db = seed({ centralCopies: 2 })

  const order = await createOrder(db, 'amor-e-sabor', input({
    customerIdentity: { type: 'table', tableId: 'table-1' },
    type: 'Local',
    idempotencyKey: 'table-one-copy',
  }), new Date('2026-09-03T23:31:00.000Z'))

  const job = db.all(`SELECT copies_requested FROM print_jobs WHERE order_id = '${order.id}'`)[0]
  assert.equal(job.copies_requested, 1)
})

test('delivery checkout snapshots the central default of one or two copies', async () => {
  const oneCopyDb = seed({ centralCopies: 1 })
  const oneCopyOrder = await createOrder(oneCopyDb, 'amor-e-sabor', input({
    idempotencyKey: 'delivery-one-copy',
  }), new Date('2026-09-03T23:31:00.000Z'))
  assert.equal(oneCopyDb.all(`SELECT copies_requested FROM print_jobs WHERE order_id = '${oneCopyOrder.id}'`)[0].copies_requested, 1)

  const twoCopyDb = seed({ centralCopies: 2 })
  const twoCopyOrder = await createOrder(twoCopyDb, 'amor-e-sabor', input({
    idempotencyKey: 'delivery-two-copies',
  }), new Date('2026-09-03T23:31:00.000Z'))
  assert.equal(twoCopyDb.all(`SELECT copies_requested FROM print_jobs WHERE order_id = '${twoCopyOrder.id}'`)[0].copies_requested, 2)
})

test('pickup checkout snapshots the central default of one or two copies', async () => {
  const oneCopyDb = seed({ centralCopies: 1 })
  const oneCopyOrder = await createOrder(oneCopyDb, 'amor-e-sabor', input({
    type: 'Retirada',
    idempotencyKey: 'pickup-one-copy',
  }), new Date('2026-09-03T23:31:00.000Z'))
  assert.equal(oneCopyDb.all(`SELECT copies_requested FROM print_jobs WHERE order_id = '${oneCopyOrder.id}'`)[0].copies_requested, 1)

  const twoCopyDb = seed({ centralCopies: 2 })
  const twoCopyOrder = await createOrder(twoCopyDb, 'amor-e-sabor', input({
    type: 'Retirada',
    idempotencyKey: 'pickup-two-copies',
  }), new Date('2026-09-03T23:31:00.000Z'))
  assert.equal(twoCopyDb.all(`SELECT copies_requested FROM print_jobs WHERE order_id = '${twoCopyOrder.id}'`)[0].copies_requested, 2)
})

test('changing the central default does not rewrite an existing automatic job copy snapshot', async () => {
  const db = seed({ centralCopies: 1 })
  const order = await createOrder(db, 'amor-e-sabor', input({
    idempotencyKey: 'immutable-copy-snapshot',
  }), new Date('2026-09-03T23:31:00.000Z'))

  db.exec(`UPDATE business_print_settings SET default_copies = 2 WHERE business_id = 'amor-e-sabor'`)

  const job = db.all(`SELECT copies_requested FROM print_jobs WHERE order_id = '${order.id}'`)[0]
  assert.equal(job.copies_requested, 1)
})

test('new scheduled order is printable immediately while keeping its scheduled time', async () => {
  const db = seed()
  const now = new Date('2026-09-03T12:00:00.000Z')
  const scheduledFor = '2026-09-03T16:00:00.000Z'

  const order = await createOrder(db, 'amor-e-sabor', input({
    idempotencyKey: 'scheduled-immediate-print',
    scheduledFor,
  }), now)

  const jobs = db.all(`SELECT created_at, available_at FROM print_jobs WHERE order_id = '${order.id}'`)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].created_at, now.toISOString())
  assert.equal(jobs[0].available_at, now.toISOString())
  assert.equal(order.scheduledFor, scheduledFor)
})

test('checkout retry with the same idempotency key keeps one order and one automatic print job', async () => {
  const db = seed()
  const first = await createOrder(db, 'amor-e-sabor', input(), new Date('2026-09-03T23:31:00.000Z'))
  const second = await createOrder(db, 'amor-e-sabor', input(), new Date('2026-09-03T23:32:00.000Z'))

  assert.equal(first.id, second.id)
  assert.equal(db.all(`SELECT * FROM orders`).length, 1)
  assert.equal(db.all(`SELECT * FROM print_jobs`).length, 1)
})

test('eligible checkout creates one unassigned automatic job without a ready primary station', async () => {
  const disabled = seed({ auto: false })
  const disabledInput = input({ idempotencyKey: 'disabled' })
  await createOrder(disabled, 'amor-e-sabor', disabledInput, new Date('2026-09-03T23:31:00.000Z'))
  await createOrder(disabled, 'amor-e-sabor', disabledInput, new Date('2026-09-03T23:32:00.000Z'))
  assert.equal(disabled.all(`SELECT * FROM print_jobs`).length, 1)
  assert.equal(disabled.all(`SELECT * FROM print_jobs`)[0].station_id, null)
  disabled.exec(`UPDATE print_stations SET auto_print_enabled = 1 WHERE id = 'station-a'`)
  assert.equal(disabled.all(`SELECT * FROM print_jobs`).length, 1)

  const secondaryOnly = seed({ primary: false })
  await createOrder(secondaryOnly, 'amor-e-sabor', input({ idempotencyKey: 'secondary' }), new Date('2026-09-03T23:31:00.000Z'))
  assert.equal(secondaryOnly.all(`SELECT * FROM print_jobs`).length, 1)
  assert.equal(secondaryOnly.all(`SELECT * FROM print_jobs`)[0].station_id, null)

  const offline = seed()
  assert.equal(offline.all(`SELECT last_seen_at FROM print_stations`)[0].last_seen_at, null)
  await createOrder(offline, 'amor-e-sabor', input({ idempotencyKey: 'offline' }), new Date('2026-09-03T23:31:00.000Z'))
  assert.equal(offline.all(`SELECT * FROM print_jobs`).length, 1)
  assert.equal(offline.all(`SELECT * FROM print_jobs`)[0].station_id, null)

  const noStation = seed()
  noStation.exec(`DELETE FROM print_stations`)
  const noStationInput = input({ idempotencyKey: 'no-station' })
  await createOrder(noStation, 'amor-e-sabor', noStationInput, new Date('2026-09-03T23:31:00.000Z'))
  await createOrder(noStation, 'amor-e-sabor', noStationInput, new Date('2026-09-03T23:32:00.000Z'))
  assert.equal(noStation.all(`SELECT * FROM orders`).length, 1)
  assert.equal(noStation.all(`SELECT * FROM print_jobs`).length, 1)
  assert.equal(noStation.all(`SELECT * FROM print_jobs`)[0].station_id, null)
})

test('historical/backdated orders never enqueue automatic kitchen printing', async () => {
  const db = seed()
  const order = await createOrder(db, 'amor-e-sabor', input({ orderDate: '2026-09-02', idempotencyKey: 'historical' }), new Date('2026-09-03T23:31:00.000Z'))
  assert.equal(order.status, 'Finalizado')
  assert.equal(db.all(`SELECT * FROM print_jobs`).length, 0)
})
