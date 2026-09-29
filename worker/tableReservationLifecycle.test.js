import assert from 'node:assert/strict'
import test from 'node:test'
import { OperationalDb } from './test-support/operationalDb.js'
import { cancelOrder } from './orderCancellation.js'
import { handleTableReservationApi } from './tableReservationApi.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-10-10T22:00:00.000Z')
const CREATED = '2026-09-29T12:00:00.000Z'

const seed = () => {
  const db = new OperationalDb()
  db.exec(`
    DELETE FROM tables WHERE business_id = '${BUSINESS}';
    INSERT INTO tables (id, business_id, name, name_key, sort_order, is_active, created_at, updated_at)
      VALUES ('table-1', '${BUSINESS}', 'Mesa 1', 'MESA 1', 1, 1, '${CREATED}', '${CREATED}');
    INSERT INTO orders (
      id, business_id, order_number, client_name_snapshot, customer_identity_type, table_tab_id,
      type, order_date, status, scheduled_for, is_backdated, subtotal_cents, delivery_fee_cents,
      adjustment_type, adjustment_mode, adjustment_value, adjustment_amount_cents, adjustment_reason,
      total_cents, created_at, idempotency_key
    ) VALUES (
      'order-1', '${BUSINESS}', 2001, 'Mesa 1', 'table', NULL,
      'Local', '2026-10-10', 'Em preparo', '2026-10-10T23:00:00.000Z', 0, 2500, 0,
      'none', 'fixed', 0, 0, '', 2500, '${CREATED}', 'reservation-lifecycle'
    );
    INSERT INTO order_items (
      id, business_id, order_id, product_id, name_snapshot, category_snapshot, size_snapshot,
      quantity, catalog_price_cents, unit_price_cents, price_reason, note, created_at
    ) VALUES (
      'item-1', '${BUSINESS}', 'order-1', NULL, 'Prato', 'Refeições', 'Un',
      1, 2500, 2500, '', '', '${CREATED}'
    );
    INSERT INTO table_reservations (
      id, business_id, order_id, table_id, table_name_snapshot, status,
      scheduled_for, ends_at, duration_minutes, revision,
      converted_table_tab_id, converted_at, cancelled_at, no_show_at,
      created_at, updated_at
    ) VALUES (
      'reservation-1', '${BUSINESS}', 'order-1', 'table-1', 'Mesa 1', 'reserved',
      '2026-10-10T23:00:00.000Z', '2026-10-11T01:00:00.000Z', 120, 3,
      NULL, NULL, NULL, NULL, '${CREATED}', '${CREATED}'
    );
    INSERT INTO print_jobs (
      id, business_id, order_id, type, trigger, status, copies_requested, copies_printed,
      station_id, snapshot_json, created_at, available_at
    ) VALUES (
      'auto-reservation', '${BUSINESS}', 'order-1', 'order', 'automatic', 'pending', 1, 0,
      NULL, '{"version":1,"type":"order","order":{"id":"order-1"}}',
      '${CREATED}', '2026-10-10T22:10:00.000Z'
    );
  `)
  return db
}

const reservationRow = (db) => db.sqlite.prepare(
  "SELECT status, revision, cancelled_at, no_show_at, converted_table_tab_id FROM table_reservations WHERE id = 'reservation-1'"
).get()

const apiCall = (db, action, body, grants = ['orders.cancel']) => {
  const request = new Request(`https://delivery.test/api/table-reservations/reservation-1/${action}`, {
    method: 'POST',
    headers: { origin: 'https://delivery.test', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleTableReservationApi(request, { DB: db, now: NOW }, {
    businessId: BUSINESS,
    sessionId: 'reservation-lifecycle',
    granted: new Set(grants),
  }, new URL(request.url))
}

test('cancelling the order from the existing order surface closes its active reservation atomically', async () => {
  const db = seed()
  const result = await cancelOrder(db, BUSINESS, 'order-1', {
    reason: 'client_changed_mind',
    refundNow: false,
  }, NOW)

  assert.equal(result.order.status, 'Cancelado')
  assert.deepEqual(reservationRow(db), {
    status: 'cancelled',
    revision: 4,
    cancelled_at: NOW.toISOString(),
    no_show_at: null,
    converted_table_tab_id: null,
  })
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM print_jobs WHERE order_id = 'order-1'").get().n, 0)
})

test('reservation cancel endpoint validates reservation revision and returns official closed effects', async () => {
  const db = seed()
  const response = await apiCall(db, 'cancel', {
    expectedRevision: 3,
    reason: 'client_changed_mind',
    refundNow: false,
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.order.status, 'Cancelado')
  assert.equal(body.reservation.status, 'cancelled')
  assert.equal(body.reservation.revision, 4)
  assert.ok(Array.isArray(body.tables))
  assert.equal(body.tables[0].nextReservation, null)
})

test('no-show uses the official cancellation reason flow but preserves no_show reservation history', async () => {
  const db = seed()
  const response = await apiCall(db, 'no-show', {
    expectedRevision: 3,
    reason: 'client_changed_mind',
    refundNow: false,
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.order.status, 'Cancelado')
  assert.equal(body.reservation.status, 'no_show')
  assert.equal(body.reservation.noShowAt, NOW.toISOString())
  assert.equal(body.reservation.cancelledAt, null)
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM table_tabs WHERE status = 'open'").get().n, 0)
})

test('stale or terminal reservation mutation cannot partially cancel the order', async () => {
  const staleDb = seed()
  await assert.rejects(
    () => apiCall(staleDb, 'cancel', {
      expectedRevision: 2,
      reason: 'client_changed_mind',
      refundNow: false,
    }),
    (error) => error.status === 409 && error.code === 'TABLE_RESERVATION_CHANGED',
  )
  assert.equal(staleDb.sqlite.prepare("SELECT status FROM orders WHERE id = 'order-1'").get().status, 'Em preparo')
  assert.equal(reservationRow(staleDb).status, 'reserved')
  assert.equal(staleDb.sqlite.prepare("SELECT COUNT(*) AS n FROM print_jobs WHERE order_id = 'order-1'").get().n, 1)

  const closedDb = seed()
  closedDb.sqlite.prepare(`UPDATE table_reservations
    SET status = 'cancelled', cancelled_at = ?, revision = revision + 1
    WHERE id = 'reservation-1'`).run(CREATED)
  await assert.rejects(
    () => apiCall(closedDb, 'no-show', {
      expectedRevision: 4,
      reason: 'client_changed_mind',
      refundNow: false,
    }),
    (error) => error.status === 409 && error.code === 'TABLE_RESERVATION_ALREADY_CLOSED',
  )
  assert.equal(closedDb.sqlite.prepare("SELECT status FROM orders WHERE id = 'order-1'").get().status, 'Em preparo')
})

test('reservation terminal mutations require orders.cancel and same-origin protection', async () => {
  const noCapability = seed()
  await assert.rejects(
    () => apiCall(noCapability, 'cancel', {
      expectedRevision: 3,
      reason: 'client_changed_mind',
    }, ['comandas.view']),
    (error) => error.status === 403 && error.code === 'FORBIDDEN',
  )

  const db = seed()
  const request = new Request('https://delivery.test/api/table-reservations/reservation-1/cancel', {
    method: 'POST',
    headers: { origin: 'https://evil.test', 'content-type': 'application/json' },
    body: JSON.stringify({ expectedRevision: 3, reason: 'client_changed_mind' }),
  })
  await assert.rejects(
    () => handleTableReservationApi(request, { DB: db }, {
      businessId: BUSINESS,
      sessionId: 'reservation-lifecycle',
      granted: new Set(['orders.cancel']),
    }, new URL(request.url)),
    (error) => error.status === 403 && error.code === 'ORIGIN_NOT_ALLOWED',
  )
})
