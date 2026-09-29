import assert from 'node:assert/strict'
import test from 'node:test'
import { OperationalDb } from './test-support/operationalDb.js'
import { handleTableReservationApi } from './tableReservationApi.js'
import { loadBootstrap } from './repositories.js'

const BUSINESS = 'amor-e-sabor'
const OTHER = 'other-business'
const CREATED = '2026-09-29T12:00:00.000Z'

const context = (...grants) => ({
  businessId: BUSINESS,
  sessionId: 'reservation-api-test',
  granted: new Set(grants),
})

const seed = () => {
  const db = new OperationalDb({ businesses: [OTHER] })
  db.exec(`
    DELETE FROM tables WHERE business_id = '${BUSINESS}';
    INSERT INTO tables (id, business_id, name, name_key, sort_order, is_active, created_at, updated_at)
      VALUES
        ('table-1', '${BUSINESS}', 'Mesa 1', 'MESA 1', 1, 1, '${CREATED}', '${CREATED}'),
        ('table-2', '${BUSINESS}', 'Mesa 2', 'MESA 2', 2, 1, '${CREATED}', '${CREATED}'),
        ('foreign-table', '${OTHER}', 'Mesa F', 'MESA F', 1, 1, '${CREATED}', '${CREATED}');
    INSERT INTO clients (id, business_id, name, phone, address, created_at, updated_at)
      VALUES ('client-1', '${BUSINESS}', 'João', '', '', '${CREATED}', '${CREATED}');
    INSERT INTO orders (
      id, business_id, order_number, client_id, client_name_snapshot, customer_identity_type,
      table_tab_id, type, order_date, status, scheduled_for, is_backdated,
      subtotal_cents, delivery_fee_cents, adjustment_type, adjustment_mode,
      adjustment_value, adjustment_amount_cents, adjustment_reason, total_cents,
      created_at, idempotency_key
    ) VALUES
      ('order-1', '${BUSINESS}', 1001, 'client-1', 'João', 'table',
       NULL, 'Local', '2026-10-10', 'Em preparo', '2026-10-10T23:00:00.000Z', 0,
       3300, 0, 'none', 'fixed', 0, 0, '', 3300, '${CREATED}', 'reservation-api-1'),
      ('order-2', '${BUSINESS}', 1002, NULL, 'Mesa 2', 'table',
       NULL, 'Local', '2026-10-11', 'Em preparo', '2026-10-11T22:00:00.000Z', 0,
       1800, 0, 'none', 'fixed', 0, 0, '', 1800, '${CREATED}', 'reservation-api-2'),
      ('foreign-order', '${OTHER}', 1, NULL, 'Mesa F', 'table',
       NULL, 'Local', '2026-10-10', 'Em preparo', '2026-10-10T21:00:00.000Z', 0,
       9999, 0, 'none', 'fixed', 0, 0, '', 9999, '${CREATED}', 'foreign-reservation');
    INSERT INTO order_items (
      id, business_id, order_id, product_id, name_snapshot, category_snapshot, size_snapshot,
      quantity, catalog_price_cents, unit_price_cents, price_reason, note, created_at
    ) VALUES
      ('item-1', '${BUSINESS}', 'order-1', NULL, 'Prato', 'Refeições', 'Un', 2, 1650, 1650, '', '', '${CREATED}'),
      ('item-2', '${BUSINESS}', 'order-2', NULL, 'Suco', 'Bebidas', 'Un', 1, 1800, 1800, '', '', '${CREATED}');
    INSERT INTO table_reservations (
      id, business_id, order_id, table_id, table_name_snapshot, status,
      scheduled_for, ends_at, duration_minutes, revision,
      converted_table_tab_id, converted_at, cancelled_at, no_show_at,
      created_at, updated_at
    ) VALUES
      ('reservation-1', '${BUSINESS}', 'order-1', 'table-1', 'Mesa 1', 'reserved',
       '2026-10-10T23:00:00.000Z', '2026-10-11T01:00:00.000Z', 120, 2,
       NULL, NULL, NULL, NULL, '${CREATED}', '${CREATED}'),
      ('reservation-2', '${BUSINESS}', 'order-2', 'table-2', 'Mesa 2', 'reserved',
       '2026-10-11T22:00:00.000Z', '2026-10-12T00:00:00.000Z', 120, 1,
       NULL, NULL, NULL, NULL, '${CREATED}', '${CREATED}'),
      ('foreign-reservation', '${OTHER}', 'foreign-order', 'foreign-table', 'Mesa F', 'reserved',
       '2026-10-10T21:00:00.000Z', '2026-10-10T23:00:00.000Z', 120, 1,
       NULL, NULL, NULL, NULL, '${CREATED}', '${CREATED}');
  `)
  db.exec(`
    INSERT INTO print_jobs (
      id, business_id, order_id, type, trigger, status, copies_requested, copies_printed,
      station_id, snapshot_json, created_at, available_at
    ) VALUES (
      'print-reservation-1', '${BUSINESS}', 'order-1', 'order', 'automatic', 'pending', 1, 0,
      NULL, '{"version":1,"type":"order","order":{"id":"order-1","number":"1001"}}',
      '${CREATED}', '2026-10-10T22:10:00.000Z'
    );
  `)
  return db
}

const call = (db, path, grants = ['orders.view']) => {
  const request = new Request(`https://delivery.test${path}`)
  return handleTableReservationApi(request, { DB: db }, context(...grants), new URL(request.url))
}

test('reservation list is business scoped, filterable and readable from Orders or Comandas access', async () => {
  const db = seed()
  const response = await call(
    db,
    '/api/table-reservations?status=reserved&tableId=table-1&from=2026-10-10T00:00:00.000Z&to=2026-10-11T00:00:00.000Z',
  )
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body.reservations.map(({ id }) => id), ['reservation-1'])
  assert.equal(body.reservations[0].clientName, 'João')
  assert.equal(body.reservations[0].itemCount, 2)

  const comandas = await call(db, '/api/table-reservations?status=reserved', ['comandas.view'])
  assert.equal(comandas.status, 200)
  assert.deepEqual((await comandas.json()).reservations.map(({ id }) => id), ['reservation-1', 'reservation-2'])

  await assert.rejects(
    () => call(db, '/api/table-reservations', []),
    (error) => error.status === 403 && error.code === 'FORBIDDEN',
  )
})

test('reservation list rejects unknown filters, invalid status and invalid date windows', async () => {
  const db = seed()
  for (const [path, code] of [
    ['/api/table-reservations?status=waiting', 'TABLE_RESERVATION_FILTER_INVALID'],
    ['/api/table-reservations?from=not-a-date', 'TABLE_RESERVATION_FILTER_INVALID'],
    ['/api/table-reservations?from=2026-10-12T00:00:00.000Z&to=2026-10-11T00:00:00.000Z', 'TABLE_RESERVATION_FILTER_INVALID'],
    ['/api/table-reservations?unexpected=1', 'TABLE_RESERVATION_FILTER_INVALID'],
  ]) {
    await assert.rejects(() => call(db, path), (error) => error.status === 400 && error.code === code)
  }
})

test('reservation detail returns official reservation, order and automatic print metadata', async () => {
  const db = seed()
  const response = await call(db, '/api/table-reservations/reservation-1', ['comandas.view'])
  assert.equal(response.status, 200)
  const body = await response.json()

  assert.equal(body.reservation.id, 'reservation-1')
  assert.equal(body.reservation.revision, 2)
  assert.equal(body.order.id, 'order-1')
  assert.equal(body.order.tableTabId, null)
  assert.equal(body.order.tableReservationId, 'reservation-1')
  assert.equal(body.order.reservationTableName, 'Mesa 1')
  assert.equal(body.printJob.id, 'print-reservation-1')
  assert.equal(body.printJob.availableAt, '2026-10-10T22:10:00.000Z')

  await assert.rejects(
    () => call(db, '/api/table-reservations/foreign-reservation', ['comandas.view']),
    (error) => error.status === 404 && error.code === 'TABLE_RESERVATION_NOT_FOUND',
  )
})

test('bootstrap exposes only nextReservation on tables and never a 90-day reservation collection', async () => {
  const db = seed()
  const bootstrap = await loadBootstrap(db, BUSINESS)
  assert.equal(Object.hasOwn(bootstrap, 'tableReservations'), false)
  assert.equal(bootstrap.tables.find(({ id }) => id === 'table-1').nextReservation.id, 'reservation-1')
  assert.equal(bootstrap.tables.find(({ id }) => id === 'table-2').nextReservation.id, 'reservation-2')
})
