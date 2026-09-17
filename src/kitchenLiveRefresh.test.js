import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(path), 'utf8')

test('worker and Orders adapter expose an orders-only GET refresh path', () => {
  const worker = read('worker/index.js')
  const ordersApiSource = read('src/domains/orders/infrastructure/ordersApi.js')
  const client = read('src/api/client.js')
  assert.match(worker, /url\.pathname === ['"]\/api\/orders['"] && request\.method === ['"]GET['"]/)
  assert.match(ordersApiSource, /getOrders:\s*\(\)\s*=>\s*request\(['"]\/api\/orders['"]\)/)
  assert.doesNotMatch(client, /export const getOrders\b/)
})

test('App enables the orders runtime only for Cozinha while the runtime owns the two-second refresh and focus behavior', () => {
  const app = read('src/App.jsx')
  const runtime = read('src/app/runtime/data/useOperationalDataRuntime.js')
  assert.match(app, /ordersSyncEnabled: activeTab === 'orders' && isOnline && authState === 'authenticated'/)
  assert.match(runtime, /getOrders/)
  assert.match(runtime, /export const ORDER_SYNC_INTERVAL_MS = 2_000/)
  assert.match(runtime, /run: refreshOrders/)
  assert.match(runtime, /intervalMs: ORDER_SYNC_INTERVAL_MS/)
  assert.match(runtime, /visibilitychange/)
  assert.match(runtime, /addEventListener\?\.\('focus'/)
})

test('kitchen UI supports one-time visual alerts and a persisted sound toggle', () => {
  const app = read('src/App.jsx')
  const arrivals = read('src/domains/orders/application/useOrderArrivals.js')
  const orders = read('src/pages/Orders.jsx')
  const css = read('src/order-operations.css')
  assert.match(app, /kitchen-sound-enabled/)
  assert.match(app, /useOrderArrivals\(/)
  assert.doesNotMatch(app, /alertedOrderIdsRef|knownOperationalOrderIdsRef|detectOperationalArrivals/)
  assert.match(arrivals, /const alertedRef = useRef\(new Set\(\)\)/)
  assert.match(arrivals, /const knownRef = useRef\(undefined\)/)
  assert.match(arrivals, /detectOperationalArrivals/)
  assert.match(arrivals, /newOrderIds/)
  assert.match(orders, /soundEnabled/)
  assert.match(orders, /onSoundEnabledChange/)
  assert.match(orders, /highlighted=\{newOrderIds\.has/)
  assert.match(css, /\.kitchen-ticket-highlighted/)
})
