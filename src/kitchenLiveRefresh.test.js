import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(path), 'utf8')

test('orders realtime helper identifies only newly discovered active orders', async () => {
  const helperPath = resolve('src/utils/orderRealtime.js')
  assert.equal(existsSync(helperPath), true, 'src/utils/orderRealtime.js must exist')
  const { activeOrderIdSet, getNewActiveOrderIds } = await import(pathToFileURL(helperPath))
  const orders = [
    { id: 'old-active', status: 'Em preparo' },
    { id: 'new-active', status: 'Em preparo' },
    { id: 'finished', status: 'Finalizado' },
  ]
  assert.deepEqual(getNewActiveOrderIds(new Set(['old-active']), orders), ['new-active'])
  assert.deepEqual([...activeOrderIdSet(orders)], ['old-active', 'new-active'])
})

test('worker and browser client expose an orders-only GET refresh path', () => {
  const worker = read('worker/index.js')
  const client = read('src/api/client.js')
  assert.match(worker, /url\.pathname === ['"]\/api\/orders['"] && request\.method === ['"]GET['"]/)
  assert.match(client, /export const getOrders\s*=\s*\(\)\s*=>\s*apiRequest\(['"]\/api\/orders['"]\)/)
})

test('App polls orders every two seconds only through the orders refresh path and refreshes on focus', () => {
  const app = read('src/App.jsx')
  assert.match(app, /getOrders as getOrdersApi/)
  assert.match(app, /const ORDER_SYNC_INTERVAL_MS = 2_000/)
  assert.match(app, /const timer = window\.setInterval/)
  assert.match(app, /},\s*ORDER_SYNC_INTERVAL_MS\)/)
  assert.match(app, /activeTab !== ['"]orders['"]/)
  assert.match(app, /visibilitychange/)
  assert.match(app, /window\.addEventListener\(['"]focus['"]/)
})

test('kitchen UI supports one-time visual alerts and a persisted sound toggle', () => {
  const app = read('src/App.jsx')
  const orders = read('src/pages/Orders.jsx')
  const css = read('src/order-operations.css')
  assert.match(app, /kitchen-sound-enabled/)
  assert.match(app, /alertedOrderIdsRef/)
  assert.match(app, /knownOperationalOrderIdsRef/)
  assert.match(app, /detectOperationalArrivals/)
  assert.match(app, /newOrderIds/)
  assert.match(orders, /soundEnabled/)
  assert.match(orders, /onSoundEnabledChange/)
  assert.match(orders, /order-new-arrival/)
  assert.match(css, /\.order-new-arrival/)
})

test('App owns the exact kitchen clock and detects arrivals on order or clock changes', () => {
  const app = read('src/App.jsx')
  assert.match(app, /useKitchenClock/)
  assert.match(app, /const kitchenNow = useKitchenClock\(orders, \{ active: activeTab === 'orders' \}\)/)
  assert.match(app, /now=\{kitchenNow\}/)
  assert.match(app, /useEffect\(\(\) => \{[\s\S]*detectOperationalArrivals[\s\S]*\}, \[[^\]]*orders[^\]]*kitchenNow[^\]]*\]\)/)
  const refreshOrdersBody = app.match(/const refreshOrders = async \(\) => \{[\s\S]*?\n    \}/)?.[0] || ''
  assert.doesNotMatch(refreshOrdersBody, /detectOperationalArrivals|getNewOperationalOrderIds|operationalOrderIdSet/)
})
