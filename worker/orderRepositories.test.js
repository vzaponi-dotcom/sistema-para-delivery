import test from 'node:test'
import assert from 'node:assert/strict'
import { OperationalDb } from './test-support/operationalDb.js'
import { createMovement, createOrder, updateOrderStatus } from './repositories.js'
import { registerOrderPayment } from './paymentRepository.js'

class OrderDb extends OperationalDb {
  constructor() {
    super({ businesses: ['other-business'] })
    const timestamp = '2026-09-01T00:00:00.000Z'
    this.exec(`
      INSERT INTO clients (id, business_id, name, created_at, updated_at) VALUES
        ('c1', 'amor-e-sabor', 'Maria', '${timestamp}', '${timestamp}'),
        ('c2', 'other-business', 'João', '${timestamp}', '${timestamp}');
      INSERT INTO products (id, business_id, category, size, name, price_cents, active, created_at, updated_at) VALUES
        ('p1', 'amor-e-sabor', 'Marmita', 'P', 'Marmita Pequena', 3200, 1, '${timestamp}', '${timestamp}'),
        ('p2', 'other-business', 'Marmita', 'P', 'Marmita Pequena', 3200, 1, '${timestamp}', '${timestamp}');
    `)
  }
}

test('createOrder calculates server cents and writes order contact snapshot and item in one batch', async () => {
  const db = new OrderDb()
  const order = await createOrder(db, 'amor-e-sabor', { clientId: 'c1', productId: 'p1', type: 'Entrega', quantity: 2, orderDate: '2026-09-01', idempotencyKey: 'request-1' }, new Date('2026-09-01T20:00:00.000Z'))
  assert.equal(order.orderNumber, 1); assert.equal(order.total, 64); assert.equal(order.items[0].quantity, 2); assert.equal(order.items[0].catalogPrice, 32); assert.equal(db.batchCalls.length, 1); assert.equal(db.all('SELECT * FROM print_jobs').length, 1); assert.equal(db.all('SELECT * FROM orders')[0].total_cents, 6400)
})

test('new orders use independent business sequences and never reuse cancelled or finalized numbers', async () => {
  const db = new OrderDb()
  const first = await createOrder(db, 'amor-e-sabor', { clientId: 'c1', productId: 'p1', type: 'Entrega', quantity: 1, orderDate: '2026-09-01', idempotencyKey: 'number-1' }, new Date('2026-09-01T20:00:00.000Z'))
  await updateOrderStatus(db, 'amor-e-sabor', first.id, new Date('2026-09-01T20:01:00.000Z'))
  const second = await createOrder(db, 'amor-e-sabor', { clientId: 'c1', productId: 'p1', type: 'Entrega', quantity: 1, orderDate: '2026-09-01', idempotencyKey: 'number-2' }, new Date('2026-09-01T20:02:00.000Z'))
  db.sqlite.prepare("UPDATE orders SET status = 'Cancelado' WHERE id = ?").run(second.id)
  const third = await createOrder(db, 'amor-e-sabor', { clientId: 'c1', productId: 'p1', type: 'Entrega', quantity: 1, orderDate: '2026-09-01', idempotencyKey: 'number-3' }, new Date('2026-09-01T20:03:00.000Z'))
  const otherBusiness = await createOrder(db, 'other-business', { clientId: 'c2', productId: 'p2', type: 'Entrega', quantity: 1, orderDate: '2026-09-01', idempotencyKey: 'other-number-1' }, new Date('2026-09-01T20:04:00.000Z'))

  assert.equal(first.orderNumber, 1)
  assert.equal(second.orderNumber, 2)
  assert.equal(third.orderNumber, 3)
  assert.equal(otherBusiness.orderNumber, 1)
})

test('same order idempotency key returns one backdated finalized order', async () => {
  const db = new OrderDb(); const payload = { clientId: 'c1', productId: 'p1', type: 'Retirada', quantity: 1, orderDate: '2026-08-31', idempotencyKey: 'same-key' }
  const first = await createOrder(db, 'amor-e-sabor', payload, new Date('2026-09-01T20:00:00.000Z')); const second = await createOrder(db, 'amor-e-sabor', payload, new Date('2026-09-01T20:01:00.000Z'))
  assert.equal(first.id, second.id); assert.equal(first.orderNumber, second.orderNumber); assert.equal(first.status, 'Finalizado'); assert.equal(db.all('SELECT * FROM orders').length, 1)
})

test('distinct concurrent creations receive distinct numbers even when sequence gaps are safer than reuse', async () => {
  const db = new OrderDb()
  const [first, second] = await Promise.all([
    createOrder(db, 'amor-e-sabor', { clientId: 'c1', productId: 'p1', type: 'Entrega', quantity: 1, orderDate: '2026-09-01', idempotencyKey: 'concurrent-1' }, new Date('2026-09-01T20:00:00.000Z')),
    createOrder(db, 'amor-e-sabor', { clientId: 'c1', productId: 'p1', type: 'Entrega', quantity: 1, orderDate: '2026-09-01', idempotencyKey: 'concurrent-2' }, new Date('2026-09-01T20:00:00.001Z')),
  ])

  assert.notEqual(first.orderNumber, second.orderNumber)
  assert.deepEqual(new Set([first.orderNumber, second.orderNumber]), new Set([1, 2]))
})

test('number uniqueness is prioritized over gapless sequencing after a failed creation', async () => {
  const db = new OrderDb()
  db.failNextBatch = true

  await assert.rejects(() => createOrder(db, 'amor-e-sabor', { clientId: 'c1', productId: 'p1', type: 'Entrega', quantity: 1, orderDate: '2026-09-01', idempotencyKey: 'failed-number' }))
  const next = await createOrder(db, 'amor-e-sabor', { clientId: 'c1', productId: 'p1', type: 'Entrega', quantity: 1, orderDate: '2026-09-01', idempotencyKey: 'after-failure' })

  assert.equal(next.orderNumber, 2)
})

test('payment uses official total and duplicate payment creates no second movement', async () => {
  const db = new OrderDb(); const order = await createOrder(db, 'amor-e-sabor', { clientId: 'c1', productId: 'p1', type: 'Entrega', quantity: 2, orderDate: '2026-09-01', idempotencyKey: 'pay-order' }, new Date('2026-09-01T20:00:00.000Z'))
  const result = await registerOrderPayment(db, 'amor-e-sabor', order.id, [{ methodCode: 'pix', amountCents: 6400 }], new Date('2026-09-01T20:05:00.000Z'))
  assert.equal(result.payment.amount, 64); assert.equal(result.movements[0].value, 64); assert.equal(result.order.paymentStatus, 'Pago'); assert.equal(db.all('SELECT * FROM movements').length, 1)
  await assert.rejects(() => registerOrderPayment(db, 'amor-e-sabor', order.id, [{ methodCode: 'pix', amountCents: 6400 }]), (error) => error.status === 409 && error.code === 'ORDER_ALREADY_PAID'); assert.equal(db.all('SELECT * FROM movements').length, 1)
})

test('finalization is idempotent and preserves paid order audit history', async () => {
  const db = new OrderDb(); const order = await createOrder(db, 'amor-e-sabor', { clientId: 'c1', productId: 'p1', type: 'Entrega', quantity: 1, orderDate: '2026-09-01', idempotencyKey: 'finish' }, new Date('2026-09-01T20:00:00.000Z'))
  const finalized = await updateOrderStatus(db, 'amor-e-sabor', order.id, new Date('2026-09-01T20:10:00.000Z')); const again = await updateOrderStatus(db, 'amor-e-sabor', order.id, new Date('2026-09-01T20:20:00.000Z')); assert.equal(again.finishedAt, finalized.finishedAt)
  await registerOrderPayment(db, 'amor-e-sabor', order.id, [{ methodCode: 'cash', amountCents: 3200 }], new Date('2026-09-01T20:30:00.000Z')); assert.equal(db.all('SELECT * FROM orders').length, 1); assert.equal(db.all('SELECT * FROM movements').length, 1); assert.equal(db.all('SELECT * FROM movements')[0].source, 'order-payment')
})

test('manual movement stores integer cents and business scope', async () => {
  const db = new OrderDb(); const movement = await createMovement(db, 'amor-e-sabor', { type: 'saida', category: 'Insumos', description: 'Arroz', valueCents: 2050 }, new Date('2026-09-01T20:00:00.000Z'))
  assert.equal(movement.value, 20.5); assert.equal(movement.source, 'manual'); assert.equal(db.all('SELECT * FROM movements')[0].business_id, 'amor-e-sabor')
})
