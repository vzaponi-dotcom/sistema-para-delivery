import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('orders page separates scheduled waiting and preparing queues using shared timing helpers', async () => {
  const source = await read('./Orders.jsx')
  assert.match(source, /scheduledOrders/)
  assert.match(source, /preparingOrders/)
  assert.match(source, /isScheduledWaiting/)
  assert.match(source, /getOperationalStartAt/)
  assert.match(source, />Agendados</)
  assert.match(source, /Desejado/)
})

test('scheduled queue hides preparation-only actions while preserving details and cancellation', async () => {
  const source = await read('./Orders.jsx')
  assert.match(source, /scheduledOrders/)
  assert.match(source, /getFinalActionLabel\(order\)/)
  assert.match(source, /order-cancel-action/)
})

test('delay statistic uses neutral wording for scheduled orders', async () => {
  const source = await read('./Orders.jsx')
  assert.match(source, /helper="Pedidos fora do prazo"/)
})
