import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mapOrderRow } from './repositories.js'

const source = readFileSync(new URL('./repositories.js', import.meta.url), 'utf8')
const baseRow = {
  id: 'o1',
  client_id: null,
  client_name_snapshot: 'Mesa A-2',
  customer_identity_type: 'table',
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

test('order row exposes explicit customer identity type without losing snapshot fields', () => {
  const order = mapOrderRow(baseRow, [])
  assert.equal(order.clientId, null)
  assert.equal(order.client, 'Mesa A-2')
  assert.equal(order.customerIdentityType, 'table')
})

test('legacy order row derives identity type from client id when column is absent', () => {
  assert.equal(mapOrderRow({ ...baseRow, client_id: 'c1', customer_identity_type: undefined }, []).customerIdentityType, 'registered_client')
  assert.equal(mapOrderRow({ ...baseRow, client_id: null, customer_identity_type: undefined }, []).customerIdentityType, 'guest_name')
})

test('order persistence stores identity type and derives server-side snapshots', () => {
  assert.match(source, /customer_identity_type/)
  assert.match(source, /customerIdentity\.type === 'guest_name'/)
  assert.match(source, /clientSnapshot = `Mesa \$\{customerIdentity\.value\}`/)
  assert.match(source, /productSnapshotSize\(item\.product\)/)
  assert.match(source, /Pagamento pedido #[^\n]*clientSnapshot/)
})
