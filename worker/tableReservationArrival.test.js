import assert from 'node:assert/strict'
import test from 'node:test'
import { OperationalDb } from './test-support/operationalDb.js'
import { confirmTableReservationArrival } from './tableReservationArrival.js'
import { handleTableReservationApi } from './tableReservationApi.js'

const BUSINESS = 'amor-e-sabor'
const CREATED = '2026-09-29T12:00:00.000Z'
const ARRIVAL = new Date('2026-10-10T22:30:00.000Z')

const seed = ({ orderStatus = 'Em preparo' } = {}) => {
  const db = new OperationalDb()
  db.exec(`
    DELETE FROM tables WHERE business_id = '${BUSINESS}';
    INSERT INTO tables (id, business_id, name, name_key, sort_order, is_active, created_at, updated_at)
      VALUES
        ('table-1', '${BUSINESS}', 'Mesa 1', 'MESA 1', 1, 1, '${CREATED}', '${CREATED}'),
        ('table-2', '${BUSINESS}', 'Mesa 2', 'MESA 2', 2, 1, '${CREATED}', '${CREATED}');
    INSERT INTO orders (
      id, business_id, order_number, client_name_snapshot, customer_identity_type, table_tab_id,
      type, order_date, status, scheduled_for, is_backdated, subtotal_cents, delivery_fee_cents,
      adjustment_type, adjustment_mode, adjustment_value, adjustment_amount_cents, adjustment_reason,
      total_cents, created_at, finished_at, idempotency_key
    ) VALUES
      ('order-1', '${BUSINESS}', 3001, 'João', 'table', NULL,
       'Local', '2026-10-10', '${orderStatus}', '2026-10-10T23:00:00.000Z', 0, 2500, 0,
       'none', 'fixed', 0, 0, '', 2500, '${CREATED}',
       ${orderStatus === 'Finalizado' ? "'2026-10-10T21:30:00.000Z'" : 'NULL'}, 'arrival-1'),
      ('order-2', '${BUSINESS}', 3002, 'Maria', 'table', NULL,
       'Local', '2026-10-11', 'Em preparo', '2026-10-11T23:00:00.000Z', 0, 1800, 0,
       'none', 'fixed', 0, 0, '', 1800, '${CREATED}', NULL, 'arrival-2');
    INSERT INTO order_items (
      id, business_id, order_id, product_id, name_snapshot, category_snapshot, size_snapshot,
      quantity, catalog_price_cents, unit_price_cents, price_reason, note, created_at
    ) VALUES
      ('item-1', '${BUSINESS}', 'order-1', NULL, 'Prato', 'Refeições', 'Un', 1, 2500, 2500, '', '', '${CREATED}'),
      ('item-2', '${BUSINESS}', 'order-2', NULL, 'Suco', 'Bebidas', 'Un', 1, 1800, 1800, '', '', '${CREATED}');
    INSERT INTO table_reservations (
      id, business_id, order_id, table_id, table_name_snapshot, status,
      scheduled_for, ends_at, duration_minutes, revision,
      converted_table_tab_id, converted_at, cancelled_at, no_show_at,
      created_at, updated_at
    ) VALUES
      ('reservation-1', '${BUSINESS}', 'order-1', 'table-1', 'Mesa 1', 'reserved',
       '2026-10-10T23:00:00.000Z', '2026-10-11T01:00:00.000Z', 120, 3,
       NULL, NULL, NULL, NULL, '${CREATED}', '${CREATED}'),
      ('reservation-2', '${BUSINESS}', 'order-2', 'table-1', 'Mesa 1', 'reserved',
       '2026-10-11T23:00:00.000Z', '2026-10-12T01:00:00.000Z', 120, 1,
       NULL, NULL, NULL, NULL, '${CREATED}', '${CREATED}');
  `)
  return db
}

const input = { expectedRevision: 3, mutationId: 'arrival-mutation-1' }

test('arrival atomically opens one comanda, links the order and converts the reservation', async () => {
  const db = seed()
  const result = await confirmTableReservationArrival(db, BUSINESS, 'reservation-1', input, ARRIVAL)

  assert.equal(result.tableTab.tableId, 'table-1')
  assert.equal(result.tableTab.status, 'open')
  assert.equal(result.order.id, 'order-1')
  assert.equal(result.order.status, 'Em preparo')
  assert.equal(result.order.tableTabId, result.tableTab.id)
  assert.equal(result.reservation.status, 'converted')
  assert.equal(result.reservation.revision, 4)
  assert.equal(result.reservation.convertedTableTabId, result.tableTab.id)
  assert.equal(result.reservation.convertedAt, ARRIVAL.toISOString())
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM table_tabs WHERE table_id = 'table-1' AND status = 'open'").get().n, 1)
})

test('arrival preserves a Finalizado order status and retry returns the same comanda', async () => {
  const db = seed({ orderStatus: 'Finalizado' })
  const first = await confirmTableReservationArrival(db, BUSINESS, 'reservation-1', input, ARRIVAL)
  const second = await confirmTableReservationArrival(db, BUSINESS, 'reservation-1', input, new Date(+ARRIVAL + 1000))

  assert.equal(first.order.status, 'Finalizado')
  assert.equal(second.order.status, 'Finalizado')
  assert.equal(second.tableTab.id, first.tableTab.id)
  assert.equal(second.reservation.convertedTableTabId, first.tableTab.id)
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM table_tabs WHERE table_id = 'table-1'").get().n, 1)
})

test('arrival rejects an early day, stale revision, cancelled order and occupied table without partial conversion', async () => {
  const early = seed()
  await assert.rejects(
    () => confirmTableReservationArrival(
      early, BUSINESS, 'reservation-1', input, new Date('2026-10-09T22:30:00.000Z'),
    ),
    (error) => error.status === 409 && error.code === 'TABLE_RESERVATION_CONFIRM_TOO_EARLY',
  )
  assert.equal(early.sqlite.prepare("SELECT COUNT(*) AS n FROM table_tabs").get().n, 0)

  const stale = seed()
  await assert.rejects(
    () => confirmTableReservationArrival(stale, BUSINESS, 'reservation-1', {
      expectedRevision: 2, mutationId: 'stale-arrival',
    }, ARRIVAL),
    (error) => error.status === 409 && error.code === 'TABLE_RESERVATION_CHANGED',
  )
  assert.equal(stale.sqlite.prepare("SELECT table_tab_id FROM orders WHERE id = 'order-1'").get().table_tab_id, null)

  const cancelled = seed()
  cancelled.sqlite.prepare("UPDATE orders SET status = 'Cancelado' WHERE id = 'order-1'").run()
  await assert.rejects(
    () => confirmTableReservationArrival(cancelled, BUSINESS, 'reservation-1', input, ARRIVAL),
    (error) => error.status === 409 && error.code === 'ORDER_CANCELLED',
  )

  const occupied = seed()
  occupied.sqlite.prepare(`INSERT INTO table_tabs (
    id, business_id, table_id, table_identifier, tab_number, status,
    opened_at, closed_at, created_at, updated_at
  ) VALUES ('existing-tab', ?, 'table-1', 'Mesa 1', 88, 'open', ?, NULL, ?, ?)`)
    .run(BUSINESS, CREATED, CREATED, CREATED)
  await assert.rejects(
    () => confirmTableReservationArrival(occupied, BUSINESS, 'reservation-1', input, ARRIVAL),
    (error) => error.status === 409 && error.code === 'TABLE_OCCUPIED',
  )
  assert.equal(occupied.sqlite.prepare("SELECT table_tab_id FROM orders WHERE id = 'order-1'").get().table_tab_id, null)
  assert.equal(occupied.sqlite.prepare("SELECT status FROM table_reservations WHERE id = 'reservation-1'").get().status, 'reserved')
})

test('confirm-arrival API requires orders.create, same origin and returns recalculated nextReservation', async () => {
  const db = seed()
  const request = new Request('https://delivery.test/api/table-reservations/reservation-1/confirm-arrival', {
    method: 'POST',
    headers: { origin: 'https://delivery.test', 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  const context = {
    businessId: BUSINESS,
    sessionId: 'arrival-api',
    granted: new Set(['orders.create']),
  }
  const response = await handleTableReservationApi(request, { DB: db, now: ARRIVAL }, context, new URL(request.url))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.reservation.status, 'converted')
  assert.equal(body.tableTab.status, 'open')
  assert.equal(body.tables.find(({ id }) => id === 'table-1').occupancy, 'occupied')
  assert.equal(body.tables.find(({ id }) => id === 'table-1').nextReservation.id, 'reservation-2')

  const forbiddenDb = seed()
  await assert.rejects(
    () => handleTableReservationApi(request, { DB: forbiddenDb, now: ARRIVAL }, {
      ...context,
      granted: new Set(['comandas.view']),
    }, new URL(request.url)),
    (error) => error.status === 403 && error.code === 'FORBIDDEN',
  )

  const wrongOrigin = new Request('https://delivery.test/api/table-reservations/reservation-1/confirm-arrival', {
    method: 'POST',
    headers: { origin: 'https://evil.test', 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  await assert.rejects(
    () => handleTableReservationApi(wrongOrigin, { DB: seed(), now: ARRIVAL }, context, new URL(wrongOrigin.url)),
    (error) => error.status === 403 && error.code === 'ORIGIN_NOT_ALLOWED',
  )
})
