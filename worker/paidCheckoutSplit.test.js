import test from 'node:test'
import assert from 'node:assert/strict'
import { OperationalDb } from './test-support/operationalDb.js'
import { createOrder } from './repositories.js'

const BUSINESS = 'amor-e-sabor'
const NOW = new Date('2026-09-21T15:00:00.000Z')

const setup = () => {
  const db = new OperationalDb()
  db.exec(`
    INSERT INTO clients (id, business_id, name, phone, address, created_at, updated_at)
    VALUES ('client-split', '${BUSINESS}', 'Cliente Split', '', '', '${NOW.toISOString()}', '${NOW.toISOString()}');
    INSERT INTO products (
      id, business_id, category, size, presentation_type, presentation_value, presentation_unit,
      name, price_cents, active, created_at, updated_at
    ) VALUES (
      'product-split', '${BUSINESS}', 'Refeições', '', 'unit', '', '',
      'Pedido Split', 8000, 1, '${NOW.toISOString()}', '${NOW.toISOString()}'
    );
  `)
  return db
}

const input = (overrides = {}) => ({
  customerIdentity: { type: 'registered_client', clientId: 'client-split' },
  type: 'Retirada',
  orderDate: '2026-09-21',
  items: [{ productId: 'product-split', quantity: 1, note: '' }],
  deliveryFeeCents: 0,
  adjustment: { type: 'none', mode: 'fixed', storedValue: 0, reason: '' },
  paymentAllocations: [
    { methodCode: 'cash', amountCents: 3000 },
    { methodCode: 'pix', amountCents: 5000 },
  ],
  idempotencyKey: 'split-checkout',
  ...overrides,
})

test('paid split checkout atomically creates one receipt, allocations, payment, movements and print job', async () => {
  const db = setup()
  const order = await createOrder(db, BUSINESS, input(), NOW)

  assert.equal(order.paymentStatus, 'Pago')
  assert.equal(db.all('SELECT * FROM payment_receipts').length, 1)
  assert.deepEqual(db.all('SELECT amount_cents FROM payment_allocations ORDER BY amount_cents').map(({ amount_cents }) => amount_cents), [3000, 5000])
  const payment = db.all('SELECT * FROM payments')[0]
  assert.equal(payment.method, null)
  assert.equal(payment.receipt_id, db.all('SELECT * FROM payment_receipts')[0].id)
  assert.deepEqual(db.all('SELECT value_cents FROM movements ORDER BY value_cents').map(({ value_cents }) => value_cents), [3000, 5000])
  assert.equal(db.all('SELECT * FROM movements').every((movement) => movement.receipt_id && movement.payment_allocation_id), true)
  assert.equal(db.all('SELECT * FROM print_jobs').length, 1)
})

test('paid checkout validates allocation sum against the server product total before any write', async () => {
  for (const [idempotencyKey, amountCents] of [['below', 7999], ['above', 8001]]) {
    const db = setup()
    await assert.rejects(
      createOrder(db, BUSINESS, input({ idempotencyKey, paymentAllocations: [{ methodCode: 'pix', amountCents }] }), NOW),
      { status: 400 },
    )
    for (const table of ['orders', 'order_items', 'payment_receipts', 'payment_allocations', 'payments', 'movements', 'print_jobs']) {
      assert.equal(db.all(`SELECT * FROM ${table}`).length, 0, `${table} must remain empty for ${idempotencyKey}`)
    }
  }
})

test('paid checkout replay returns the original receipt without duplicating financial or print effects', async () => {
  const db = setup()
  const first = await createOrder(db, BUSINESS, input(), NOW)
  const second = await createOrder(db, BUSINESS, input(), new Date(+NOW + 60_000))

  assert.equal(second.id, first.id)
  assert.equal(db.all('SELECT * FROM payment_receipts').length, 1)
  assert.equal(db.all('SELECT * FROM payment_allocations').length, 2)
  assert.equal(db.all('SELECT * FROM payments').length, 1)
  assert.equal(db.all('SELECT * FROM movements').length, 2)
  assert.equal(db.all('SELECT * FROM print_jobs').length, 1)
})
