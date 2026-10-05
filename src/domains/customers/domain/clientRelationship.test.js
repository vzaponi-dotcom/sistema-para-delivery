import test from 'node:test'
import assert from 'node:assert/strict'
import * as model from './clientList.js'

const clients = [{ id: 'ana', name: 'Ana' }, { id: 'other', name: 'Ana' }, { id: 'empty', name: 'Bia' }]
const orders = [
  { id: 'old', clientId: 'ana', orderDate: '2026-08-01', status: 'Finalizado', total: 20.10, paymentStatus: 'Pago', items: [{ productId: 'p', name: 'Café', quantity: 2 }] },
  { id: 'recent', clientId: 'ana', orderDate: '2026-10-04', status: 'Em preparo', total: 10.20, paymentStatus: 'Pendente', items: [{ productId: 'p', name: 'Café', quantity: 1 }] },
  { id: 'cancel', clientId: 'ana', orderDate: '2026-10-05', status: 'Cancelado', total: 99, paymentStatus: 'Pendente', items: [{ productId: 'x', name: 'Bolo', quantity: 10 }] },
  { id: 'namesake', clientId: 'other', orderDate: '2026-08-01', status: 'Finalizado', total: 50, paymentStatus: 'Pendente', items: [] },
]

test('customer totals use identity, exclude cancelled sales and rank products by quantity', () => {
  assert.equal(typeof model.buildClientRelationships, 'function')
  const map = model.buildClientRelationships(clients, orders, { now: new Date('2026-10-05T12:00:00Z') })
  const ana = map.get('ana')
  assert.equal(ana.orderCount, 3)
  assert.equal(ana.cancelledCount, 1)
  assert.equal(ana.total, 30.30)
  assert.equal(ana.average, 15.15)
  assert.equal(ana.pending, 10.20)
  assert.equal(ana.lastPurchase, '2026-10-04')
  assert.equal(ana.daysSincePurchase, 1)
  assert.deepEqual(ana.favorites, [{ key: 'p', name: 'Café', quantity: 3 }])
  assert.equal(map.get('other').pending, 50)
  assert.equal(map.get('empty').orderCount, 0)
})

test('relationship filters distinguish no orders, open balance and thirty days without purchases', () => {
  assert.equal(typeof model.buildClientRelationships, 'function')
  const relationships = model.buildClientRelationships(clients, orders, { now: new Date('2026-10-05T12:00:00Z') })
  const filter = value => model.filterAndSortClients(clients, { relationships, filter: value }).map(c => c.id)
  assert.deepEqual(filter('pending'), ['ana', 'other'])
  assert.deepEqual(filter('inactive'), ['other'])
  assert.deepEqual(filter('empty'), ['empty'])
  assert.deepEqual(model.filterAndSortClients(clients, { relationships, sort: 'recent' }).map(c => c.id), ['ana', 'other', 'empty'])
})

test('recurrence distinguishes a first purchase from repeated purchases on the same day', () => {
  const purchase = { clientId: 'ana', orderDate: '2026-10-04', status: 'Finalizado', total: 10 }
  const frequency = rows => model.buildClientRelationships(clients, rows).get('ana').frequencyDays
  assert.equal(frequency([purchase]), null)
  assert.equal(frequency([purchase, { ...purchase, id: 'second' }]), 0)
  assert.equal(frequency([purchase, { ...purchase, status: 'Cancelado' }]), null)
})
