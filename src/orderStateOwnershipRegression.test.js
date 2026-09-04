import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('App owns cancellation API and History consumes the central order collection', async () => {
  const app = await read('./App.jsx')
  const orders = await read('./pages/Orders.jsx')
  const history = await read('./pages/OrderHistory.jsx')
  const shell = await read('./components/AppShell.jsx')

  assert.match(app, /cancelOrder as cancelOrderApi/)
  assert.match(app, /<OrderHistory/)
  assert.match(app, /onCancelOrder=\{handleCancelOrder\}/)
  assert.doesNotMatch(orders, /cancelOrder as cancelOrderApi/)
  assert.doesNotMatch(orders, /cancelledIds/)
  assert.doesNotMatch(history, /getOrders as getOrdersApi/)
  assert.doesNotMatch(history, /cancelOrder as cancelOrderApi/)
  assert.doesNotMatch(shell, /<OrderHistory\s*\/>/)
})

test('central cancellation applies all authoritative effects immediately before success feedback', async () => {
  const app = await read('./App.jsx')

  assert.match(app, /const handleCancelOrder = async \(orderId, payload\)/)
  assert.match(app, /const \{ order, movement, tableTab \} = await cancelOrderApi/)
  assert.match(app, /applyOfficialEffects\(\{ order, movement, tableTab \}\)/)
  assert.match(app, /const applyOfficialEffects = \(\{[^}]*tableTab/)
  assert.match(app, /if \(order\) setOrders\(\(current\) => upsertById\(current, order\)\)/)
  assert.match(app, /if \(movement\) setMovements\(\(current\) => upsertById\(current, movement\)\)/)
  assert.match(app, /if \(tableTab\) setTableTabs\(\(current\) => upsertById\(current, tableTab\)\)/)
  assert.match(app, /showSuccessMessage\(payload\.refundNow \? 'Pedido cancelado e estorno registrado' : 'Pedido cancelado com sucesso'\)/)
})
