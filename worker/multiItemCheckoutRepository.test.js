import test from 'node:test'
import assert from 'node:assert/strict'
import { OperationalDb } from './test-support/operationalDb.js'
import { createOrder, mapOrderItemRow, mapOrderRow } from './repositories.js'

class CheckoutDb extends OperationalDb {
  constructor() {
    super({ businesses: ['outro-negocio'] })
    const timestamp = '2026-09-01T00:00:00.000Z'
    this.exec(`
      INSERT INTO clients (id, business_id, name, phone, created_at, updated_at) VALUES
        ('c1', 'amor-e-sabor', 'Maria', '11999999999', '${timestamp}', '${timestamp}'),
        ('other-client', 'outro-negocio', 'Outro cliente', '', '${timestamp}', '${timestamp}');
      INSERT INTO products (id, business_id, category, size, name, price_cents, active, created_at, updated_at) VALUES
        ('p1', 'amor-e-sabor', 'Marmita', 'G', 'Marmita G', 3200, 1, '${timestamp}', '${timestamp}'),
        ('p2', 'amor-e-sabor', 'Bebida', 'Lata', 'Coca', 800, 1, '${timestamp}', '${timestamp}');
      INSERT INTO tables (id, business_id, name, name_key, sort_order, is_active, created_at, updated_at) VALUES
        ('table-1', 'amor-e-sabor', 'Mesa 4', 'MESA 4', 1, 1, '${timestamp}', '${timestamp}'),
        ('table-inactive', 'amor-e-sabor', 'Mesa 5', 'MESA 5', 2, 0, '${timestamp}', '${timestamp}'),
        ('other-table', 'outro-negocio', 'Mesa 6', 'MESA 6', 1, 1, '${timestamp}', '${timestamp}');
    `)
  }
}

const baseInput = (overrides = {}) => ({
  clientId: 'c1',
  type: 'Entrega',
  orderDate: '2026-09-01',
  idempotencyKey: 'multi-1',
  items: [
    { productId: 'p1', quantity: 2, note: 'sem cebola' },
    { productId: 'p2', quantity: 1, note: '' },
  ],
  deliveryFeeCents: 800,
  adjustment: { type: 'discount', mode: 'percentage', storedValue: 1000, reason: '' },
  paymentMethod: null,
  ...overrides,
})

const tableInput = (tableId, idempotencyKey, clientId) => baseInput({
  clientId: null,
  customerIdentity: { type: 'table', tableId, ...(clientId ? { clientId } : {}) },
  type: 'Local',
  idempotencyKey,
  items: [{ productId: 'p1', quantity: 1, note: '' }],
  deliveryFeeCents: 0,
  adjustment: { type: 'none', mode: 'fixed', storedValue: 0, reason: '' },
  paymentMethod: null,
})

test('order/item mapping exposes delivery fee, note and friendly percentage', () => {
  const item = mapOrderItemRow({ id: 'i1', product_id: 'p1', name_snapshot: 'Marmita G', category_snapshot: 'Marmita', size_snapshot: 'G', quantity: 1, catalog_price_cents: 3200, unit_price_cents: 3200, price_reason: '', note: 'sem cebola' })
  const order = mapOrderRow({
    id: 'o1', client_name_snapshot: 'Maria', type: 'Entrega', status: 'Em preparo', order_date: '2026-09-01',
    subtotal_cents: 3200, delivery_fee_cents: 800, adjustment_type: 'discount', adjustment_mode: 'percentage',
    adjustment_value: 750, adjustment_amount_cents: 240, adjustment_reason: 'fidelidade', total_cents: 3760,
    created_at: '2026-09-01T20:00:00.000Z', finished_at: null,
  }, [item])
  assert.equal(item.note, 'sem cebola')
  assert.equal(order.deliveryFee, 8)
  assert.equal(order.adjustment.value, 7.5)
})

test('order mapping exposes scheduled metadata and backdated marker', () => {
  const order = mapOrderRow({
    id: 'o-scheduled', client_name_snapshot: 'Maria', type: 'Entrega', status: 'Em preparo', order_date: '2026-09-04',
    scheduled_for: '2026-09-04T15:00:00.000Z', is_backdated: 0, subtotal_cents: 1000, delivery_fee_cents: 0,
    adjustment_type: 'none', adjustment_mode: 'fixed', adjustment_value: 0, adjustment_amount_cents: 0, total_cents: 1000,
    created_at: '2026-09-04T12:00:00.000Z', finished_at: null,
  })
  assert.equal(order.scheduledFor, '2026-09-04T15:00:00.000Z')
  assert.equal(order.isBackdated, false)
})

test('createOrder uses server product prices for several items, fee and adjustment', async () => {
  const db = new CheckoutDb()
  const order = await createOrder(db, 'amor-e-sabor', baseInput(), new Date('2026-09-01T20:00:00.000Z'))
  assert.equal(order.items.length, 2)
  assert.equal(order.items[0].note, 'sem cebola')
  assert.equal(order.subtotal, 72)
  assert.equal(order.deliveryFee, 8)
  assert.equal(order.adjustment.amount, 7.2)
  assert.equal(order.total, 72.8)
  assert.equal(order.paymentStatus, 'Pendente')
})

test('local orders without a client reuse the persistent table tab and its exact name snapshot', async () => {
  const db = new CheckoutDb()
  const now = new Date('2026-09-02T18:00:00.000Z')
  const first = await createOrder(db, 'amor-e-sabor', tableInput('table-1', 'tab-a-1'), now)
  const second = await createOrder(db, 'amor-e-sabor', tableInput('table-1', 'tab-a-2'), new Date('2026-09-02T18:01:00.000Z'))

  assert.equal(first.tableTabId, second.tableTabId)
  assert.equal(db.all('SELECT * FROM table_tabs').filter((tab) => tab.status === 'open').length, 1)
  assert.equal(db.all('SELECT * FROM table_tabs')[0].table_id, 'table-1')
  assert.equal(db.all('SELECT * FROM table_tabs')[0].table_identifier, 'Mesa 4')
  assert.equal(db.all('SELECT * FROM table_tabs')[0].tab_number, 1)
  assert.equal(first.clientId, null)
  assert.equal(first.client, 'Mesa 4')
  assert.equal(first.customerIdentityType, 'table')
})

test('local order persists an optional same-business client snapshot', async () => {
  const db = new CheckoutDb()
  const order = await createOrder(
    db,
    'amor-e-sabor',
    tableInput('table-1', 'table-client', 'c1'),
    new Date('2026-09-02T18:00:00.000Z'),
  )

  assert.equal(order.clientId, 'c1')
  assert.equal(order.client, 'Mesa 4 · Maria')
  assert.equal(db.all('SELECT client_name_snapshot FROM orders')[0].client_name_snapshot, 'Maria')
  assert.equal(order.customerIdentityType, 'table')
  assert.equal(order.tableTabId, db.all('SELECT * FROM table_tabs')[0].id)
  assert.equal(db.all('SELECT * FROM table_tabs')[0].tab_number, 1)
})

test('local order rejects an optional client from another business', async () => {
  const db = new CheckoutDb()

  await assert.rejects(
    () => createOrder(db, 'amor-e-sabor', tableInput('table-1', 'cross-client', 'other-client'), new Date('2026-09-02T18:00:00.000Z')),
    (error) => error.status === 404 && error.code === 'CLIENT_NOT_FOUND',
  )
  assert.equal(db.all('SELECT * FROM orders').length, 0)
})

test('paid retry creates one order, payment and movement and stays Em preparo', async () => {
  const db = new CheckoutDb()
  const payload = baseInput({
    idempotencyKey: 'paid-1',
    items: [{ productId: 'p1', quantity: 1, note: '' }],
    deliveryFeeCents: 0,
    adjustment: { type: 'none', mode: 'fixed', storedValue: 0, reason: '' },
    paymentMethod: 'Pix',
  })
  const first = await createOrder(db, 'amor-e-sabor', payload, new Date('2026-09-01T20:00:00.000Z'))
  const second = await createOrder(db, 'amor-e-sabor', payload, new Date('2026-09-01T20:01:00.000Z'))
  assert.equal(first.id, second.id)
  assert.equal(first.status, 'Em preparo')
  assert.equal(first.paymentStatus, 'Pago')
  assert.equal(db.all('SELECT * FROM orders').length, 1)
  assert.equal(db.all('SELECT * FROM payments').length, 1)
  assert.equal(db.all('SELECT * FROM movements').length, 1)
})

test('failed paid checkout rolls back order items payment and movement together', async () => {
  const db = new CheckoutDb()
  db.failNextBatch = true
  await assert.rejects(() => createOrder(db, 'amor-e-sabor', baseInput({ paymentMethod: 'Pix' }), new Date('2026-09-01T20:00:00.000Z')))
  assert.equal(db.all('SELECT * FROM orders').length, 0)
  assert.equal(db.all('SELECT * FROM order_items').length, 0)
  assert.equal(db.all('SELECT * FROM payments').length, 0)
  assert.equal(db.all('SELECT * FROM movements').length, 0)
})
