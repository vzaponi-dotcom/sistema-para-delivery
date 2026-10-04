import test from 'node:test'
import assert from 'node:assert/strict'

const now = new Date('2026-10-05T01:30:00Z') // still October 4 in São Paulo
const orders = [
  { id: 'a', orderNumber: 1, client: 'Ana', status: 'Finalizado', createdAt: '2026-09-30T15:00:00Z', finishedAt: '2026-10-04T20:00:00Z', items: [{ name: 'Café', quantity: 1 }] },
  { id: 'b', orderNumber: 2, client: 'Bruno', status: 'Cancelado', createdAt: '2026-10-04T15:00:00Z', finishedAt: '2026-10-04T16:00:00Z', cancelledAt: '2026-10-05T01:00:00Z', items: [{ name: 'Suco', quantity: 1 }] },
  { id: 'c', orderNumber: 3, client: 'Carla', status: 'Finalizado', createdAt: '2026-10-03T15:00:00Z', finishedAt: '2026-10-03T17:00:00Z', items: [{ name: 'Café', quantity: 2 }] },
  { id: 'd', orderNumber: 4, client: 'Dora', status: 'Em preparo', createdAt: '2026-10-04T15:00:00Z', items: [{ name: 'Café', quantity: 1 }] },
]
async function model() { return (await import('./historyQuery.js').catch(() => ({}))).getHistoryView }

test('history periods use terminal events in São Paulo and sort cancellations by their cancellation time', async () => {
  const getHistoryView = await model()
  assert.equal(typeof getHistoryView, 'function')
  const view = getHistoryView(orders, { period: 'today', filter: 'all' }, now)
  assert.deepEqual(view.orders.map(o => o.id), ['b', 'a'])
  assert.deepEqual(view.counts, { all: 2, finalized: 1, cancelled: 1 })
  assert.equal(view.groups[0].date, '2026-10-04')
  assert.deepEqual(getHistoryView(orders, { period: 'yesterday' }, now).orders.map(o => o.id), ['c'])
})

test('history combines accented product search, displayed order number, period and status without mutating orders', async () => {
  const getHistoryView = await model()
  assert.equal(typeof getHistoryView, 'function')
  const before = JSON.stringify(orders)
  assert.deepEqual(getHistoryView(orders, { period: '7d', search: 'cafe', filter: 'finalized' }, now).orders.map(o => o.id), ['a', 'c'])
  assert.deepEqual(getHistoryView(orders, { period: 'today', search: '#2', filter: 'cancelled' }, now).orders.map(o => o.id), ['b'])
  assert.equal(JSON.stringify(orders), before)
})

test('custom history dates are inclusive and invalid or inverted ranges never expose unrelated records', async () => {
  const getHistoryView = await model()
  assert.equal(typeof getHistoryView, 'function')
  const query = { period: 'custom', startDate: '2026-10-03', endDate: '2026-10-04' }
  assert.deepEqual(getHistoryView(orders, query, now).orders.map(o => o.id), ['b', 'a', 'c'])
  for (const invalid of [{ startDate: '2026-10-05', endDate: '2026-10-04' }, { startDate: '', endDate: '2026-10-04' }, { startDate: '2026-02-31', endDate: '2026-10-04' }]) {
    const view = getHistoryView(orders, { ...query, ...invalid }, now)
    assert.equal(view.validRange, false)
    assert.deepEqual(view.orders, [])
  }
})
