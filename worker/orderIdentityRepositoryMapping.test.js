import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mapOrderRow, mapTableTabRow } from './repositories.js'

const source = readFileSync(new URL('./repositories.js', import.meta.url), 'utf8')
const orderReadSql = readFileSync(new URL('./orderReadSql.js', import.meta.url), 'utf8')
const baseRow = {
  id: 'o1',
  client_id: null,
  client_name_snapshot: 'Mesa A-2',
  customer_identity_type: 'table',
  table_tab_id: 'tab-1',
  type: 'Local',
  status: 'Em preparo',
  subtotal_cents: 1000,
  delivery_fee_cents: 0,
  adjustment_type: 'none',
  adjustment_mode: 'fixed',
  adjustment_value: 0,
  adjustment_amount_cents: 0,
  adjustment_reason: '',
  total_cents: 1000,
  order_date: '2026-09-02',
  created_at: '2026-09-02T12:00:00.000Z',
  finished_at: null,
  payment_id: null,
}

test('order row exposes explicit customer identity and table tab without losing snapshot fields', () => {
  const order = mapOrderRow(baseRow, [])
  assert.equal(order.clientId, null)
  assert.equal(order.client, 'Mesa A-2')
  assert.equal(order.customerIdentityType, 'table')
  assert.equal(order.tableTabId, 'tab-1')
})

test('table tab row maps the persistent session fields for the UI', () => {
  assert.deepEqual(mapTableTabRow({
    id: 'tab-1',
    table_id: 'table-1',
    table_identifier: '04',
    status: 'open',
    opened_at: '2026-09-02T18:00:00.000Z',
    closed_at: null,
  }), {
    id: 'tab-1',
    tableId: 'table-1',
    tableIdentifier: '04',
    status: 'open',
    openedAt: '2026-09-02T18:00:00.000Z',
    closedAt: null,
  })
})

test('legacy order row derives identity type and keeps table tab optional', () => {
  assert.equal(mapOrderRow({ ...baseRow, client_id: 'c1', customer_identity_type: undefined, table_tab_id: undefined }, []).customerIdentityType, 'registered_client')
  assert.equal(mapOrderRow({ ...baseRow, client_id: null, customer_identity_type: undefined, table_tab_id: undefined }, []).customerIdentityType, 'guest_name')
  assert.equal(mapOrderRow({ ...baseRow, table_tab_id: undefined }, []).tableTabId, null)
})

test('order persistence stores identity type and derives server-side snapshots', () => {
  assert.match(source, /customer_identity_type/)
  assert.match(source, /table_tab_id/)
  assert.match(source, /productSnapshotSize\(item\.product\)/)
  assert.match(source, /Pagamento pedido #[^\n]*clientSnapshot/)
})

test('order row maps promised payment date and official order reads select it', () => {
  assert.equal(mapOrderRow({ ...baseRow, promised_payment_date: '2026-09-11' }, []).promisedPaymentDate, '2026-09-11')
  assert.equal(mapOrderRow({ ...baseRow, promised_payment_date: null }, []).promisedPaymentDate, null)
  assert.match(orderReadSql, /o\.promised_payment_date/)
  assert.match(source, /o\.promised_payment_date/)
})
