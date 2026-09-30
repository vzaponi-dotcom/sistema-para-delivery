import assert from 'node:assert/strict'
import test from 'node:test'
import { OperationalDb } from './test-support/operationalDb.js'
import {
  listNextTableReservations,
  listTableReservations,
  loadNextTableReservationForTable,
  loadTableReservationById,
  loadTableReservationByOrderId,
  mapTableReservationRow,
} from './tableReservationRepository.js'

const BUSINESS = 'biz-a'
const OTHER = 'biz-b'
const CREATED = '2026-09-29T12:00:00.000Z'

const seedTable = (db, { id, businessId = BUSINESS, name, sortOrder }) => {
  db.exec(`INSERT INTO tables (
    id, business_id, name, name_key, sort_order, is_active, created_at, updated_at
  ) VALUES (
    '${id}', '${businessId}', '${name}', '${name.toUpperCase()}', ${sortOrder}, 1, '${CREATED}', '${CREATED}'
  )`)
}

const seedClient = (db, { id, businessId = BUSINESS, name }) => {
  db.exec(`INSERT INTO clients (id, business_id, name, created_at, updated_at)
    VALUES ('${id}', '${businessId}', '${name}', '${CREATED}', '${CREATED}')`)
}

const seedOrder = (db, {
  id,
  businessId = BUSINESS,
  number,
  clientId = null,
  clientName,
  scheduledFor,
  totalCents,
}) => {
  const clientSql = clientId ? `'${clientId}'` : 'NULL'
  db.exec(`INSERT INTO orders (
    id, business_id, order_number, client_id, client_name_snapshot,
    customer_identity_type, table_tab_id, type, order_date, status,
    scheduled_for, is_backdated, subtotal_cents, delivery_fee_cents,
    adjustment_type, adjustment_mode, adjustment_value, adjustment_amount_cents,
    adjustment_reason, total_cents, created_at, finished_at, idempotency_key
  ) VALUES (
    '${id}', '${businessId}', ${number}, ${clientSql}, '${clientName}',
    'table', NULL, 'Local', substr('${scheduledFor}', 1, 10), 'Em preparo',
    '${scheduledFor}', 0, ${totalCents}, 0,
    'none', 'fixed', 0, 0, '',
    ${totalCents}, '${CREATED}', NULL, 'key-${id}'
  )`)
}

const seedItem = (db, { id, orderId, businessId = BUSINESS, quantity }) => {
  db.exec(`INSERT INTO order_items (
    id, business_id, order_id, product_id, name_snapshot, category_snapshot,
    size_snapshot, quantity, catalog_price_cents, unit_price_cents, price_reason, note, created_at
  ) VALUES (
    '${id}', '${businessId}', '${orderId}', NULL, 'Produto', 'Refeições',
    'Un', ${quantity}, 1000, 1000, '', '', '${CREATED}'
  )`)
}

const seedReservation = (db, {
  id,
  businessId = BUSINESS,
  orderId,
  tableId,
  tableName,
  status = 'reserved',
  scheduledFor,
  endsAt,
  revision = 1,
  cancelledAt = null,
}) => {
  const cancelledSql = cancelledAt ? `'${cancelledAt}'` : 'NULL'
  db.exec(`INSERT INTO table_reservations (
    id, business_id, order_id, table_id, table_name_snapshot, status,
    scheduled_for, ends_at, duration_minutes, revision,
    converted_table_tab_id, converted_at, cancelled_at, no_show_at,
    created_at, updated_at
  ) VALUES (
    '${id}', '${businessId}', '${orderId}', '${tableId}', '${tableName}', '${status}',
    '${scheduledFor}', '${endsAt}', 120, ${revision},
    NULL, NULL, ${cancelledSql}, NULL,
    '${CREATED}', '${CREATED}'
  )`)
}

const setup = () => {
  const db = new OperationalDb({ businesses: [BUSINESS, OTHER] })
  seedTable(db, { id: 'table-1', name: 'Mesa 1', sortOrder: 1 })
  seedTable(db, { id: 'table-2', name: 'Varanda', sortOrder: 2 })
  seedTable(db, { id: 'foreign-table', businessId: OTHER, name: 'Mesa F', sortOrder: 1 })
  seedClient(db, { id: 'client-1', name: 'João' })
  seedClient(db, { id: 'foreign-client', businessId: OTHER, name: 'Outro' })

  seedOrder(db, {
    id: 'order-1', number: 1, clientId: 'client-1', clientName: 'João',
    scheduledFor: '2026-10-10T23:00:00.000Z', totalCents: 3300,
  })
  seedItem(db, { id: 'item-1a', orderId: 'order-1', quantity: 2 })
  seedItem(db, { id: 'item-1b', orderId: 'order-1', quantity: 1 })
  seedReservation(db, {
    id: 'reservation-1', orderId: 'order-1', tableId: 'table-1', tableName: 'Mesa 1',
    scheduledFor: '2026-10-10T23:00:00.000Z', endsAt: '2026-10-11T01:00:00.000Z', revision: 3,
  })

  seedOrder(db, {
    id: 'order-2', number: 2, clientName: 'Mesa 1',
    scheduledFor: '2026-10-11T23:00:00.000Z', totalCents: 1800,
  })
  seedItem(db, { id: 'item-2', orderId: 'order-2', quantity: 1 })
  seedReservation(db, {
    id: 'reservation-2', orderId: 'order-2', tableId: 'table-1', tableName: 'Mesa 1',
    scheduledFor: '2026-10-11T23:00:00.000Z', endsAt: '2026-10-12T01:00:00.000Z',
  })

  seedOrder(db, {
    id: 'order-3', number: 3, clientName: 'Varanda',
    scheduledFor: '2026-10-09T21:00:00.000Z', totalCents: 2500,
  })
  seedItem(db, { id: 'item-3', orderId: 'order-3', quantity: 4 })
  seedReservation(db, {
    id: 'reservation-3', orderId: 'order-3', tableId: 'table-2', tableName: 'Varanda',
    scheduledFor: '2026-10-09T21:00:00.000Z', endsAt: '2026-10-09T23:00:00.000Z',
  })

  seedOrder(db, {
    id: 'order-cancelled', number: 4, clientName: 'Varanda',
    scheduledFor: '2026-10-08T21:00:00.000Z', totalCents: 1000,
  })
  seedReservation(db, {
    id: 'reservation-cancelled', orderId: 'order-cancelled', tableId: 'table-2', tableName: 'Varanda',
    status: 'cancelled',
    scheduledFor: '2026-10-08T21:00:00.000Z', endsAt: '2026-10-08T23:00:00.000Z',
    cancelledAt: CREATED,
  })

  seedOrder(db, {
    id: 'foreign-order', businessId: OTHER, number: 1, clientId: 'foreign-client', clientName: 'Outro',
    scheduledFor: '2026-10-07T21:00:00.000Z', totalCents: 9999,
  })
  seedReservation(db, {
    id: 'foreign-reservation', businessId: OTHER, orderId: 'foreign-order',
    tableId: 'foreign-table', tableName: 'Mesa F',
    scheduledFor: '2026-10-07T21:00:00.000Z', endsAt: '2026-10-07T23:00:00.000Z',
  })
  return db
}

test('mapTableReservationRow exposes durable lifecycle and operational summary fields', () => {
  assert.deepEqual(mapTableReservationRow({
    id: 'r1', order_id: 'o1', order_number: 42, table_id: 't1',
    table_name: 'Mesa atual', table_name_snapshot: 'Mesa antiga', status: 'reserved',
    scheduled_for: '2026-10-10T23:00:00.000Z', ends_at: '2026-10-11T01:00:00.000Z',
    duration_minutes: 120, revision: 3, converted_table_tab_id: null,
    converted_at: null, cancelled_at: null, no_show_at: null,
    created_at: CREATED, updated_at: CREATED, client_id: 'c1', client_name: 'João',
    item_count: 3, total_cents: 3300, order_status: 'Em preparo',
  }), {
    id: 'r1',
    orderId: 'o1',
    orderNumber: 42,
    tableId: 't1',
    tableName: 'Mesa atual',
    status: 'reserved',
    scheduledFor: '2026-10-10T23:00:00.000Z',
    endsAt: '2026-10-11T01:00:00.000Z',
    durationMinutes: 120,
    revision: 3,
    convertedTableTabId: null,
    convertedAt: null,
    cancelledAt: null,
    noShowAt: null,
    createdAt: CREATED,
    updatedAt: CREATED,
    clientId: 'c1',
    clientName: 'João',
    itemCount: 3,
    totalCents: 3300,
    orderStatus: 'Em preparo',
  })
})

test('reservation repository is business scoped and loads by id or order', async () => {
  const db = setup()
  const byId = await loadTableReservationById(db, BUSINESS, 'reservation-1')
  const byOrder = await loadTableReservationByOrderId(db, BUSINESS, 'order-1')

  assert.equal(byId.id, 'reservation-1')
  assert.equal(byId.tableName, 'Mesa 1')
  assert.equal(byId.clientName, 'João')
  assert.equal(byId.itemCount, 3)
  assert.equal(byId.totalCents, 3300)
  assert.equal(byId.revision, 3)
  assert.deepEqual(byOrder, byId)

  assert.equal(await loadTableReservationById(db, BUSINESS, 'foreign-reservation'), null)
  assert.equal(await loadTableReservationByOrderId(db, BUSINESS, 'foreign-order'), null)
})

test('reservation list supports status, table and half-open date filters ordered by schedule', async () => {
  const db = setup()
  const reserved = await listTableReservations(db, BUSINESS, {
    status: 'reserved',
    from: '2026-10-10T00:00:00.000Z',
    to: '2026-10-12T00:00:00.000Z',
  })
  assert.deepEqual(reserved.map(({ id }) => id), ['reservation-1', 'reservation-2'])

  const table = await listTableReservations(db, BUSINESS, { tableId: 'table-2' })
  assert.deepEqual(table.map(({ id }) => id), ['reservation-cancelled', 'reservation-3'])

  const beforeBoundary = await listTableReservations(db, BUSINESS, {
    to: '2026-10-10T23:00:00.000Z',
  })
  assert.deepEqual(beforeBoundary.map(({ id }) => id), ['reservation-cancelled', 'reservation-3'])
})

test('next reservation projection returns only the earliest reserved commitment for each table', async () => {
  const db = setup()
  const next = await listNextTableReservations(db, BUSINESS)

  assert.deepEqual(next.map(({ id }) => id), ['reservation-3', 'reservation-1'])
  assert.equal((await loadNextTableReservationForTable(db, BUSINESS, 'table-1')).id, 'reservation-1')
  assert.equal((await loadNextTableReservationForTable(db, BUSINESS, 'table-2')).id, 'reservation-3')
  assert.equal(await loadNextTableReservationForTable(db, BUSINESS, 'foreign-table'), null)
})
