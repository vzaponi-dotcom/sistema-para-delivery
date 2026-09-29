import test from 'node:test'
import assert from 'node:assert/strict'
import { listOrders } from './orderReadRepository.js'

class OrderReadDb {
  prepare(sql) {
    return {
      bind() {
        return {
          async all() {
            if (sql.includes('FROM orders o')) {
              assert.match(sql, /o\.cancelled_at/)
              assert.match(sql, /o\.scheduled_for/)
              assert.match(sql, /o\.is_backdated/)
              assert.match(sql, /o\.cancel_reason/)
              assert.match(sql, /o\.cancel_reason_note/)
              assert.match(sql, /cr\.label AS cancel_reason_label/)
              assert.match(sql, /LEFT JOIN business_cancel_reasons cr/)
              assert.match(sql, /r\.id AS refund_movement_id/)
              assert.match(sql, /r\.created_at AS refund_created_at/)
              assert.match(sql, /source = 'order-refund'/)
              assert.match(sql, /LEFT JOIN table_tabs tt ON tt\.id = o\.table_tab_id AND tt\.business_id = o\.business_id/)
              assert.match(sql, /tt\.table_identifier AS table_identifier/)
              assert.match(sql, /LEFT JOIN table_reservations tr ON tr\.order_id = o\.id AND tr\.business_id = o\.business_id/)
              assert.match(sql, /LEFT JOIN tables rt ON rt\.id = tr\.table_id AND rt\.business_id = tr\.business_id/)
              assert.match(sql, /tr\.id AS table_reservation_id/)
              assert.match(sql, /tr\.status AS table_reservation_status/)
              assert.match(sql, /tr\.table_id AS reservation_table_id/)
              assert.match(sql, /reservation_table_name/)
              assert.match(sql, /tr\.revision AS reservation_revision/)
              assert.match(sql, /payment_allocations/)
              assert.match(sql, /p\.receipt_id/)
              assert.match(sql, /payment_allocations_json/)
              return {
                results: [
                  {
                    id: 'o1', client_id: 'c1', client_name_snapshot: 'Maria', customer_identity_type: 'registered_client', table_tab_id: null,
                    type: 'Entrega', order_date: '2026-09-03', status: 'Cancelado', subtotal_cents: 8000, delivery_fee_cents: 0,
                    adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0, adjustment_amount_cents: 0, adjustment_reason: '',
                    total_cents: 8000, created_at: '2026-09-03T12:00:00.000Z', finished_at: null,
                    scheduled_for: '2026-09-03T15:00:00.000Z', is_backdated: 0,
                    cancelled_at: '2026-09-03T13:00:00.000Z', cancel_reason: 'client_changed_mind', cancel_reason_label: 'Cliente desistiu', cancel_reason_note: null,
                    payment_id: 'pay-1', receipt_id: 'receipt-1', payment_method: null, paid_at: '2026-09-03T12:05:00.000Z', paid_amount_cents: 8000,
                    payment_allocations_json: '[{"methodCode":"pix","methodLabel":"Pix","amountCents":8000}]',
                    refund_movement_id: 'refund-1', refund_created_at: '2026-09-03T13:05:00.000Z',
                  },
                  {
                    id: 'o2', client_id: 'c2', client_name_snapshot: 'João', customer_identity_type: 'registered_client', table_tab_id: null,
                    type: 'Retirada', order_date: '2026-09-01', status: 'Cancelado', subtotal_cents: 4500, delivery_fee_cents: 0,
                    adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0, adjustment_amount_cents: 0, adjustment_reason: '',
                    total_cents: 4500, created_at: '2026-09-01T12:00:00.000Z', finished_at: null,
                    cancelled_at: null, cancel_reason: null, cancel_reason_note: null,
                    payment_id: null, payment_method: null, paid_at: null, paid_amount_cents: null,
                    refund_movement_id: null, refund_created_at: null,
                  },
                  {
                    id: 'o3', client_id: null, client_name_snapshot: 'Mesa 4', customer_identity_type: 'table', table_tab_id: 'tab-4', table_identifier: 'Mesa 4',
                    type: 'Local', order_date: '2026-09-01', status: 'Em preparo', subtotal_cents: 4500, delivery_fee_cents: 0,
                    adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0, adjustment_amount_cents: 0, adjustment_reason: '',
                    total_cents: 4500, created_at: '2026-09-01T13:00:00.000Z', finished_at: null,
                    cancelled_at: null, cancel_reason: null, cancel_reason_note: null,
                    payment_id: null, payment_method: null, paid_at: null, paid_amount_cents: null,
                    refund_movement_id: null, refund_created_at: null,
                  },
                  {
                    id: 'o4', client_id: 'c4', client_name_snapshot: 'Hugo', customer_identity_type: 'table', table_tab_id: 'tab-4', table_identifier: 'Mesa 4',
                    type: 'Local', order_date: '2026-09-01', status: 'Em preparo', subtotal_cents: 4500, delivery_fee_cents: 0,
                    adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0, adjustment_amount_cents: 0, adjustment_reason: '',
                    total_cents: 4500, created_at: '2026-09-01T14:00:00.000Z', finished_at: null,
                    cancelled_at: null, cancel_reason: null, cancel_reason_note: null,
                    payment_id: null, payment_method: null, paid_at: null, paid_amount_cents: null,
                    refund_movement_id: null, refund_created_at: null,
                  },
                  {
                    id: 'o5', client_id: null, client_name_snapshot: 'Nome legado', customer_identity_type: 'guest_name', table_tab_id: null, table_identifier: null,
                    type: 'Local', order_date: '2026-09-01', status: 'Em preparo', subtotal_cents: 4500, delivery_fee_cents: 0,
                    adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0, adjustment_amount_cents: 0, adjustment_reason: '',
                    total_cents: 4500, created_at: '2026-09-01T15:00:00.000Z', finished_at: null,
                    cancelled_at: null, cancel_reason: null, cancel_reason_note: null,
                    payment_id: null, payment_method: null, paid_at: null, paid_amount_cents: null,
                    refund_movement_id: null, refund_created_at: null,
                  },
                  {
                    id: 'o6', client_id: 'c6', client_name_snapshot: 'Ana', customer_identity_type: 'table', table_tab_id: null, table_identifier: null,
                    table_reservation_id: 'reservation-6', table_reservation_status: 'reserved', reservation_table_id: 'table-6',
                    reservation_table_name: 'Mesa 6', reservation_revision: 4,
                    type: 'Local', order_date: '2026-10-10', status: 'Em preparo', subtotal_cents: 5200, delivery_fee_cents: 0,
                    adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0, adjustment_amount_cents: 0, adjustment_reason: '',
                    total_cents: 5200, created_at: '2026-09-29T12:00:00.000Z', finished_at: null,
                    scheduled_for: '2026-10-10T23:00:00.000Z', is_backdated: 0,
                    cancelled_at: null, cancel_reason: null, cancel_reason_note: null,
                    payment_id: null, payment_method: null, paid_at: null, paid_amount_cents: null,
                    refund_movement_id: null, refund_created_at: null,
                  },
                ],
              }
            }
            if (sql.includes('FROM order_items')) return { results: [] }
            return { results: [] }
          },
        }
      },
    }
  }
}

test('orders-only reads preserve official cancellation, table snapshots and historical identities', async () => {
  const [order, legacy, tableWithoutClient, tableWithClient, guestName, reservation] = await listOrders(new OrderReadDb(), 'amor-e-sabor')

  assert.equal(order.cancelledAt, '2026-09-03T13:00:00.000Z')
  assert.equal(order.cancelReasonLabel, 'Cliente desistiu')
  assert.equal(order.refundMovementId, 'refund-1')
  assert.equal(order.refundedAt, '2026-09-03T13:05:00.000Z')
  assert.equal(order.refundState, 'refunded')
  assert.equal(order.paymentMethod, 'Pix')
  assert.deepEqual(order.paymentAllocations, [{ methodCode: 'pix', methodLabel: 'Pix', amountCents: 8000 }])
  assert.equal(order.scheduledFor, '2026-09-03T15:00:00.000Z')
  assert.equal(order.isBackdated, false)
  assert.equal(legacy.cancelledAt, null)
  assert.equal(tableWithoutClient.tableIdentifier, 'Mesa 4')
  assert.equal(tableWithoutClient.client, 'Mesa 4')
  assert.equal(tableWithClient.tableIdentifier, 'Mesa 4')
  assert.equal(tableWithClient.client, 'Mesa 4 · Hugo')
  assert.equal(guestName.client, 'Nome legado')
  assert.equal(reservation.tableTabId, null)
  assert.equal(reservation.tableReservationId, 'reservation-6')
  assert.equal(reservation.tableReservationStatus, 'reserved')
  assert.equal(reservation.reservationTableId, 'table-6')
  assert.equal(reservation.reservationTableName, 'Mesa 6')
  assert.equal(reservation.reservationRevision, 4)
  assert.equal(reservation.tableIdentifier, 'Mesa 6')
  assert.equal(reservation.client, 'Mesa 6 · Ana')
})
