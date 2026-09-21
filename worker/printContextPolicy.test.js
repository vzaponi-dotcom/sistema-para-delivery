import test from 'node:test'
import assert from 'node:assert/strict'
import { createSettingsDb } from './test-support/settingsDb.js'
import {
  createManualOrderPrintJob,
  createManualTableTabPrintJob,
  requestSecondCopy,
  reprintPrintJob,
  retryPrintJob,
} from './orderPrintingRepository.js'
import { createOrder } from './repositories.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-12T18:00:00.000Z')
const orderDocument = { version: 1, type: 'order', order: { id: 'order-policy', number: 19 }, items: [] }
const tabDocument = { version: 1, type: 'table-tab', tableTab: { id: 'tab-policy', number: 17, tableName: 'Mesa 7' }, items: [] }

const setup = (t) => {
  const fixture = createSettingsDb()
  t.after(fixture.close)
  fixture.sqlite.prepare(`INSERT INTO orders (
    id, business_id, order_number, client_name_snapshot, type, status, order_date,
    subtotal_cents, total_cents, created_at
  ) VALUES ('order-policy', ?, 19, 'Local', 'Local', 'Em preparo', '2026-09-12', 2500, 2500, ?)`)
    .run(BUSINESS, NOW.toISOString())
  fixture.sqlite.prepare(`INSERT INTO orders (
    id, business_id, order_number, client_name_snapshot, type, status, order_date,
    subtotal_cents, total_cents, created_at
  ) VALUES ('order-counter', ?, 20, 'Local', 'Local', 'Em preparo', '2026-09-12', 2500, 2500, ?)`)
    .run(BUSINESS, NOW.toISOString())
  fixture.sqlite.prepare(`INSERT INTO tables (id, business_id, name, name_key, sort_order, is_active, created_at, updated_at)
    VALUES ('table-policy', ?, 'Mesa 7', 'mesa 7', 1, 1, ?, ?)`)
    .run(BUSINESS, NOW.toISOString(), NOW.toISOString())
  fixture.sqlite.prepare(`INSERT INTO table_tabs (
    id, business_id, table_id, table_identifier, tab_number, status, opened_at, closed_at, created_at, updated_at
  ) VALUES ('tab-policy', ?, 'table-policy', 'Mesa 7', 17, 'open', ?, NULL, ?, ?)`)
    .run(BUSINESS, NOW.toISOString(), NOW.toISOString(), NOW.toISOString())
  fixture.sqlite.prepare(`UPDATE orders SET customer_identity_type = 'table', table_tab_id = 'tab-policy'
    WHERE id = 'order-policy'`).run()
  fixture.sqlite.prepare(`INSERT INTO products (
    id, business_id, category, size, name, price_cents, active, created_at, updated_at
  ) VALUES ('product-policy', ?, 'Meals', '', 'Prato', 2500, 1, ?, ?)`)
    .run(BUSINESS, NOW.toISOString(), NOW.toISOString())
  return fixture
}

const checkout = (idempotencyKey, customerIdentity) => ({
  customerIdentity,
  type: 'Local',
  orderDate: '2026-09-12',
  items: [{ productId: 'product-policy', quantity: 1, note: '' }],
  deliveryFeeCents: 0,
  adjustment: { type: 'none', mode: 'fixed', storedValue: 0, reason: '' },
  paymentAllocations: null,
  idempotencyKey,
})

test('automatic checkout snapshots copies from durable identity, not the Local modality text', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.prepare(`UPDATE business_print_settings SET default_copies = 1,
    table_tab_default_copies = 2 WHERE business_id = ?`).run(BUSINESS)

  const counter = await createOrder(db, BUSINESS, checkout('counter-local', {
    type: 'guest_name', value: 'Balcão Local',
  }), NOW)
  const table = await createOrder(db, BUSINESS, {
    ...checkout('table-local', { type: 'table', tableId: 'table-policy', clientId: null }),
    expectedTableTabId: 'tab-policy',
  }, new Date(+NOW + 1000))

  assert.equal(sqlite.prepare('SELECT copies_requested FROM print_jobs WHERE order_id = ?').get(counter.id).copies_requested, 1)
  assert.equal(sqlite.prepare('SELECT copies_requested FROM print_jobs WHERE order_id = ?').get(table.id).copies_requested, 2)
})

test('automatic checkout guards the printing revision in the order and job batch', async (t) => {
  const { db, sqlite } = setup(t)
  const batch = db.batch.bind(db)
  let raced = false
  db.batch = async (statements) => {
    if (!raced) {
      raced = true
      sqlite.prepare('UPDATE business_print_settings SET revision = revision + 1 WHERE business_id = ?').run(BUSINESS)
    }
    return batch(statements)
  }

  await assert.rejects(createOrder(db, BUSINESS, checkout('automatic-raced', {
    type: 'guest_name', value: 'Cliente',
  }), NOW), { status: 409, code: 'POLICY_CHANGED' })
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM orders WHERE idempotency_key = 'automatic-raced'").get().n, 0)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM print_jobs').get().n, 0)
})

test('manual commercial jobs use revisioned context defaults and strict explicit overrides', async (t) => {
  const { db, sqlite } = setup(t)
  sqlite.prepare(`UPDATE business_print_settings
    SET default_copies = 2, table_tab_default_copies = 1 WHERE business_id = ?`).run(BUSINESS)

  const order = await createManualOrderPrintJob(db, BUSINESS, {
    id: 'manual-order-default', orderId: 'order-counter', document: orderDocument,
  }, NOW)
  const linkedOrder = await createManualOrderPrintJob(db, BUSINESS, {
    id: 'manual-order-table-default', orderId: 'order-policy', document: orderDocument,
  }, NOW)
  const tab = await createManualTableTabPrintJob(db, BUSINESS, {
    id: 'manual-tab-default', tableTabId: 'tab-policy', document: tabDocument,
  }, NOW)
  const overridden = await createManualTableTabPrintJob(db, BUSINESS, {
    id: 'manual-tab-override', tableTabId: 'tab-policy', copies: 2, document: tabDocument,
  }, NOW)

  assert.equal(order.copiesRequested, 2)
  assert.equal(linkedOrder.copiesRequested, 1)
  assert.equal(tab.copiesRequested, 1)
  assert.equal(overridden.copiesRequested, 2)
  await assert.rejects(createManualOrderPrintJob(db, BUSINESS, {
    id: 'manual-invalid', orderId: 'order-policy', copies: '1', document: orderDocument,
  }, NOW), { status: 400, code: 'INVALID_PRINT_COPIES' })
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM print_jobs WHERE id = 'manual-invalid'").get().n, 0)
})

test('a printing-policy revision race aborts job creation atomically', async (t) => {
  const { db, sqlite } = setup(t)
  const batch = db.batch.bind(db)
  db.batch = async (statements) => {
    sqlite.prepare('UPDATE business_print_settings SET revision = revision + 1 WHERE business_id = ?').run(BUSINESS)
    return batch(statements)
  }

  await assert.rejects(createManualOrderPrintJob(db, BUSINESS, {
    id: 'manual-raced', orderId: 'order-policy', document: orderDocument,
  }, NOW), { status: 409, code: 'POLICY_CHANGED' })
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM print_jobs WHERE id = 'manual-raced'").get().n, 0)
})

test('a two-copy comanda keeps its snapshot and identity across close, request and retry', async (t) => {
  const { db, sqlite } = setup(t)
  const created = await createManualTableTabPrintJob(db, BUSINESS, {
    id: 'tab-two-copy', tableTabId: 'tab-policy', copies: 2, document: tabDocument,
  }, NOW)
  sqlite.prepare("UPDATE print_jobs SET status = 'awaiting_second_copy', copies_printed = 1 WHERE id = ?").run(created.id)
  sqlite.prepare("UPDATE orders SET status = 'Cancelado', cancelled_at = ? WHERE id = 'order-policy'").run(NOW.toISOString())
  sqlite.prepare("UPDATE table_tabs SET status = 'closed', closed_at = ? WHERE id = 'tab-policy'").run(NOW.toISOString())

  const requested = await requestSecondCopy(db, BUSINESS, created.id, 'Operador', new Date(+NOW + 1000))
  assert.equal(requested.status, 'pending')
  assert.equal(requested.tableTabId, 'tab-policy')
  assert.equal(requested.parentJobId, null)
  assert.equal(requested.copiesRequested, 2)
  assert.deepEqual(requested.document, tabDocument)

  sqlite.prepare("UPDATE print_jobs SET status = 'failed', last_error_code = 'PRINT_FAILED' WHERE id = ?").run(created.id)
  const retried = await retryPrintJob(db, BUSINESS, created.id, new Date(+NOW + 2000), 'Operador')
  assert.equal(retried.status, 'awaiting_second_copy')
  assert.equal(retried.id, created.id)
  assert.deepEqual(retried.document, tabDocument)
})

test('reprint remains a new order job linked to its immutable parent', async (t) => {
  const { db, sqlite } = setup(t)
  const original = await createManualOrderPrintJob(db, BUSINESS, {
    id: 'order-original', orderId: 'order-counter', copies: 1, document: orderDocument,
  }, NOW)
  sqlite.prepare("UPDATE print_jobs SET status = 'printed', copies_printed = 1 WHERE id = ?").run(original.id)

  const reprint = await reprintPrintJob(db, BUSINESS, original.id, 2, orderDocument, new Date(+NOW + 1000))
  assert.notEqual(reprint.id, original.id)
  assert.equal(reprint.parentJobId, original.id)
  assert.equal(reprint.type, 'order')
  assert.equal(reprint.trigger, 'manual')
  assert.equal(reprint.copiesRequested, 2)
  assert.deepEqual(reprint.document, orderDocument)
})
