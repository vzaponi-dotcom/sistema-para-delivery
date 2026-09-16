import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('App owns cancellation API and History consumes the central order collection', async () => {
  const app = await read('./App.jsx')
  const orders = await read('./pages/Orders.jsx')
  const history = await read('./pages/OrderHistory.jsx')
  const shell = await read('./app/shell/AppShell.jsx')

  assert.match(app, /cancelOrder as cancelOrderApi/)
  assert.match(app, /<OrderHistory/)
  assert.match(app, /onCancelOrder=\{handleCancelOrder\}/)
  assert.doesNotMatch(orders, /cancelOrder as cancelOrderApi/)
  assert.doesNotMatch(orders, /cancelledIds/)
  assert.doesNotMatch(history, /getOrders as getOrdersApi/)
  assert.doesNotMatch(history, /cancelOrder as cancelOrderApi/)
  assert.doesNotMatch(shell, /<OrderHistory\s*\/>/)
})

test('central cancellation applies authoritative effects through the operational runtime before success feedback', async () => {
  const [app, runtime] = await Promise.all([
    read('./App.jsx'),
    read('./app/runtime/data/useOperationalDataRuntime.js'),
  ])

  assert.match(app, /const handleCancelOrder = async \(orderId, payload\)/)
  assert.match(app, /const \{ order, movement, tableTab \} = await cancelOrderApi/)
  assert.match(app, /applyOfficialEffects\(\{ order, movement, tableTab \}\)/)
  assert.match(runtime, /const applyOfficialEffects = useCallback/)
  assert.match(runtime, /if \(order\) setOrders\(\(current\) => upsertById\(current, order\)\)/)
  assert.match(runtime, /if \(movement\) setMovements\(\(current\) => upsertById\(current, movement\)\)/)
  assert.match(runtime, /if \(tableTab\) setTableTabs\(\(current\) => upsertById\(current, tableTab\)\)/)
  assert.match(app, /showSuccessMessage\(payload\.refundNow \? 'Pedido cancelado e estorno registrado' : 'Pedido cancelado com sucesso'\)/)
})
