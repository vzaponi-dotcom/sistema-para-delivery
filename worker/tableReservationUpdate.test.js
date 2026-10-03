import assert from 'node:assert/strict'
import test from 'node:test'
import { OperationalDb } from './test-support/operationalDb.js'
import { updateTableReservation } from './tableReservationUpdate.js'
import { handleTableReservationApi } from './tableReservationApi.js'

const BUSINESS = 'amor-e-sabor'
const CREATED = '2026-09-29T12:00:00.000Z'
const NOW = new Date('2026-10-10T20:00:00.000Z')

const product = (id, name, priceCents, active = 1) => `
  INSERT INTO products (
    id, business_id, category, size, presentation_type, presentation_value, presentation_unit,
    name, price_cents, active, created_at, updated_at
  ) VALUES (
    '${id}', '${BUSINESS}', 'Refeições', 'Un', 'unit', '', '',
    '${name}', ${priceCents}, ${active}, '${CREATED}', '${CREATED}'
  );`

const seed = ({ conflict = false, autoStatus = 'pending', manual = true } = {}) => {
  const db = new OperationalDb()
  db.exec(`
    DELETE FROM tables WHERE business_id = '${BUSINESS}';
    INSERT INTO tables (id, business_id, name, name_key, sort_order, is_active, created_at, updated_at)
      VALUES
        ('table-1', '${BUSINESS}', 'Mesa 1', 'MESA 1', 1, 1, '${CREATED}', '${CREATED}'),
        ('table-2', '${BUSINESS}', 'Mesa 2', 'MESA 2', 2, 1, '${CREATED}', '${CREATED}');
    INSERT INTO clients (id, business_id, name, phone, address, created_at, updated_at)
      VALUES
        ('client-1', '${BUSINESS}', 'João', '11999990001', 'Rua 1', '${CREATED}', '${CREATED}'),
        ('client-2', '${BUSINESS}', 'Maria', '11999990002', 'Rua 2', '${CREATED}', '${CREATED}');
    ${product('product-1', 'Prato antigo', 2500)}
    ${product('product-2', 'Prato novo', 3200)}
    ${product('product-inactive', 'Produto inativo', 9999, 0)}
    INSERT INTO orders (
      id, business_id, order_number, client_id, client_name_snapshot, client_phone_snapshot,
      client_address_snapshot, customer_identity_type, table_tab_id, type, order_date, status,
      scheduled_for, is_backdated, subtotal_cents, delivery_fee_cents,
      adjustment_type, adjustment_mode, adjustment_value, adjustment_amount_cents,
      adjustment_reason, total_cents, created_at, idempotency_key
    ) VALUES (
      'order-1', '${BUSINESS}', 4001, 'client-1', 'João', '(11) 99999-0001',
      'Rua 1', 'table', NULL, 'Local', '2026-10-10', 'Em preparo',
      '2026-10-10T23:00:00.000Z', 0, 2500, 0,
      'none', 'fixed', 0, 0, '', 2500, '${CREATED}', 'reservation-update'
    );
    INSERT INTO order_items (
      id, business_id, order_id, product_id, name_snapshot, category_snapshot, size_snapshot,
      quantity, catalog_price_cents, unit_price_cents, price_reason, note, created_at
    ) VALUES (
      'item-old', '${BUSINESS}', 'order-1', 'product-1', 'Prato antigo', 'Refeições', 'Un',
      1, 2500, 2500, '', 'antigo', '${CREATED}'
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
      'auto-1', '${BUSINESS}', 'order-1', 'order', 'automatic', '${autoStatus}', 2, 0,
      NULL, '{"old":true}', '${CREATED}', '2026-10-10T22:10:00.000Z'
    );
  `)
  if (manual) {
    db.exec(`INSERT INTO print_jobs (
      id, business_id, order_id, type, trigger, status, copies_requested, copies_printed,
      station_id, snapshot_json, created_at, available_at, processed_at
    ) VALUES (
      'manual-1', '${BUSINESS}', 'order-1', 'order', 'manual', 'printed', 1, 1,
      NULL, '{"manual":true}', '${CREATED}', '${CREATED}', '${CREATED}'
    )`)
  }
  if (conflict) {
    db.exec(`
      INSERT INTO orders (
        id, business_id, order_number, client_name_snapshot, customer_identity_type, table_tab_id,
        type, order_date, status, scheduled_for, is_backdated, subtotal_cents, delivery_fee_cents,
        adjustment_type, adjustment_mode, adjustment_value, adjustment_amount_cents,
        adjustment_reason, total_cents, created_at, idempotency_key
      ) VALUES (
        'order-conflict', '${BUSINESS}', 4002, 'Mesa 2', 'table', NULL,
        'Local', '2026-10-11', 'Em preparo', '2026-10-11T22:30:00.000Z', 0, 1000, 0,
        'none', 'fixed', 0, 0, '', 1000, '${CREATED}', 'reservation-conflict'
      );
      INSERT INTO table_reservations (
        id, business_id, order_id, table_id, table_name_snapshot, status,
        scheduled_for, ends_at, duration_minutes, revision,
        converted_table_tab_id, converted_at, cancelled_at, no_show_at,
        created_at, updated_at
      ) VALUES (
        'reservation-conflict', '${BUSINESS}', 'order-conflict', 'table-2', 'Mesa 2', 'reserved',
        '2026-10-11T22:30:00.000Z', '2026-10-12T00:30:00.000Z', 120, 1,
        NULL, NULL, NULL, NULL, '${CREATED}', '${CREATED}'
      );
    `)
  }
  return db
}

const updateInput = (patch = {}) => ({
  expectedRevision: 3,
  customerIdentity: { type: 'table', tableId: 'table-2', clientId: 'client-2' },
  type: 'Local',
  orderDate: '2026-10-11',
  scheduledFor: '2026-10-11T23:00:00.000Z',
  items: [{ productId: 'product-2', quantity: 2, note: 'sem cebola' }],
  deliveryFeeCents: 0,
  adjustment: { type: 'discount', mode: 'fixed', storedValue: 500, reason: 'Cortesia' },
  ...patch,
})

test('reservation edit reprices and atomically replaces the pending snapshot without changing order identity', async () => {
  const db = seed()
  const result = await updateTableReservation(db, BUSINESS, 'reservation-1', updateInput(), NOW)

  assert.equal(result.order.id, 'order-1')
  assert.equal(result.order.orderNumber, 4001)
  assert.equal(result.order.clientId, 'client-2')
  assert.equal(result.order.client, 'Mesa 2 · Maria')
  assert.equal(result.order.orderDate, '2026-10-11')
  assert.equal(result.order.scheduledFor, '2026-10-11T23:00:00.000Z')
  assert.equal(result.order.subtotal, 64)
  assert.equal(result.order.adjustment.amount, 5)
  assert.equal(result.order.total, 59)
  assert.deepEqual(result.order.items.map((item) => ({
    productId: item.productId, quantity: item.quantity, note: item.note, unitPrice: item.unitPrice,
  })), [{ productId: 'product-2', quantity: 2, note: 'sem cebola', unitPrice: 32 }])

  assert.equal(result.reservation.tableId, 'table-2')
  assert.equal(result.reservation.tableName, 'Mesa 2')
  assert.equal(result.reservation.scheduledFor, '2026-10-11T23:00:00.000Z')
  assert.equal(result.reservation.endsAt, '2026-10-12T01:00:00.000Z')
  assert.equal(result.reservation.revision, 4)
  assert.equal(result.hasManualPrintHistory, true)

  const auto = db.sqlite.prepare("SELECT id, copies_requested, status, snapshot_json, available_at FROM print_jobs WHERE id = 'auto-1'").get()
  assert.equal(auto.id, 'auto-1')
  assert.equal(auto.copies_requested, 2)
  assert.equal(auto.status, 'pending')
  assert.equal(auto.available_at, '2026-10-11T22:10:00.000Z')
  const document = JSON.parse(auto.snapshot_json)
  assert.equal(document.order.scheduleLabel, 'RESERVA')
  assert.equal(document.order.scheduledFor, '2026-10-11T23:00:00.000Z')
  assert.equal(document.customer.name, 'Mesa 2 · Maria')
  assert.equal(document.items[0].name, 'Prato novo')
  assert.equal(document.items[0].unitPriceCents, 3200)
  assert.equal(document.financial.totalCents, 5900)
})

test('inactive product, reservation conflict and stale revision roll back every edit effect', async () => {
  const inactive = seed()
  await assert.rejects(
    () => updateTableReservation(inactive, BUSINESS, 'reservation-1', updateInput({
      items: [{ productId: 'product-inactive', quantity: 1, note: '' }],
    }), NOW),
    (error) => error.status === 404 && error.code === 'PRODUCT_NOT_FOUND',
  )
  assert.equal(inactive.sqlite.prepare("SELECT table_id FROM table_reservations WHERE id = 'reservation-1'").get().table_id, 'table-1')
  assert.equal(inactive.sqlite.prepare("SELECT product_id FROM order_items WHERE order_id = 'order-1'").get().product_id, 'product-1')
  assert.equal(JSON.parse(inactive.sqlite.prepare("SELECT snapshot_json FROM print_jobs WHERE id = 'auto-1'").get().snapshot_json).old, true)

  const conflict = seed({ conflict: true })
  await assert.rejects(
    () => updateTableReservation(conflict, BUSINESS, 'reservation-1', updateInput(), NOW),
    (error) => error.status === 409 && error.code === 'TABLE_RESERVATION_CONFLICT',
  )
  assert.equal(conflict.sqlite.prepare("SELECT revision FROM table_reservations WHERE id = 'reservation-1'").get().revision, 3)
  assert.equal(conflict.sqlite.prepare("SELECT product_id FROM order_items WHERE order_id = 'order-1'").get().product_id, 'product-1')

  const stale = seed()
  await assert.rejects(
    () => updateTableReservation(stale, BUSINESS, 'reservation-1', updateInput({ expectedRevision: 2 }), NOW),
    (error) => error.status === 409 && error.code === 'TABLE_RESERVATION_CHANGED',
  )
  assert.equal(stale.sqlite.prepare("SELECT revision FROM table_reservations WHERE id = 'reservation-1'").get().revision, 3)
})

test('reservation edit is blocked after operational start and for terminal reservations', async () => {
  const started = seed()
  await assert.rejects(
    () => updateTableReservation(
      started,
      BUSINESS,
      'reservation-1',
      updateInput(),
      new Date('2026-10-10T22:11:00.000Z'),
    ),
    (error) => error.status === 409 && error.code === 'TABLE_RESERVATION_NOT_EDITABLE',
  )

  const terminal = seed()
  terminal.sqlite.prepare(`UPDATE table_reservations
    SET status = 'cancelled', cancelled_at = ?, revision = 4
    WHERE id = 'reservation-1'`).run(CREATED)
  await assert.rejects(
    () => updateTableReservation(terminal, BUSINESS, 'reservation-1', updateInput({ expectedRevision: 4 }), NOW),
    (error) => error.status === 409 && error.code === 'TABLE_RESERVATION_ALREADY_CLOSED',
  )
})

test('discarded automatic job is never revived and missing automatic job is never backfilled during edit', async () => {
  const discarded = seed({ autoStatus: 'discarded', manual: false })
  const before = discarded.sqlite.prepare("SELECT snapshot_json, available_at, status FROM print_jobs WHERE id = 'auto-1'").get()
  const edited = await updateTableReservation(discarded, BUSINESS, 'reservation-1', updateInput(), NOW)
  assert.equal(edited.hasManualPrintHistory, false)
  assert.deepEqual({ ...discarded.sqlite.prepare("SELECT snapshot_json, available_at, status FROM print_jobs WHERE id = 'auto-1'").get() }, { ...before })

  const missing = seed({ manual: false })
  missing.sqlite.prepare("DELETE FROM print_jobs WHERE id = 'auto-1'").run()
  await updateTableReservation(missing, BUSINESS, 'reservation-1', updateInput(), NOW)
  assert.equal(missing.sqlite.prepare("SELECT COUNT(*) AS n FROM print_jobs WHERE order_id = 'order-1' AND trigger = 'automatic'").get().n, 0)
})

test('PUT reservation endpoint validates capability and adjustment permission and returns official effects', async () => {
  const db = seed()
  const body = {
    expectedRevision: 3,
    customerIdentity: { type: 'table', tableId: 'table-2', clientId: 'client-2' },
    type: 'Local',
    orderDate: '2026-10-11',
    scheduledFor: '2026-10-11T23:00:00.000Z',
    items: [{ productId: 'product-2', quantity: 2, note: 'sem cebola' }],
    deliveryFee: 0,
    adjustment: { type: 'discount', mode: 'fixed', value: 5, reason: 'Cortesia' },
  }
  const request = new Request('https://delivery.test/api/table-reservations/reservation-1', {
    method: 'PUT',
    headers: { origin: 'https://delivery.test', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const baseContext = { businessId: BUSINESS, sessionId: 'reservation-update' }

  await assert.rejects(
    () => handleTableReservationApi(request.clone(), { DB: db, now: NOW }, {
      ...baseContext, granted: new Set(['comandas.view']),
    }, new URL(request.url)),
    (error) => error.status === 403 && error.code === 'FORBIDDEN',
  )
  await assert.rejects(
    () => handleTableReservationApi(request.clone(), { DB: db, now: NOW }, {
      ...baseContext, granted: new Set(['orders.create']),
    }, new URL(request.url)),
    (error) => error.status === 403 && error.code === 'FORBIDDEN',
  )

  const response = await handleTableReservationApi(request, { DB: db, now: NOW }, {
    ...baseContext, granted: new Set(['orders.create', 'orders.discount', 'orders.view', 'tables.view', 'printing.queue']),
  }, new URL(request.url))
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.reservation.revision, 4)
  assert.equal(payload.order.total, 59)
  assert.equal(payload.hasManualPrintHistory, true)
  assert.equal(payload.tables.find(({ id }) => id === 'table-2').nextReservation.id, 'reservation-1')
})
