import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from 'react-test-renderer'
import { workspaceHarness } from './test-support/renderWorkspace.js'
import { authenticatedSession } from './test-support/appSessionFixtures.js'

const read = (path) => readFileSync(resolve(path), 'utf8')

test('worker and Orders adapter expose an orders-only GET refresh path', () => {
  const worker = read('worker/index.js')
  const ordersApiSource = read('src/domains/orders/infrastructure/ordersApi.js')
  assert.match(worker, /url\.pathname === ['"]\/api\/orders['"] && request\.method === ['"]GET['"]/)
  assert.match(ordersApiSource, /getOrders:\s*\(\)\s*=>\s*request\(['"]\/api\/orders['"]\)/)
  assert.equal(existsSync('src/api/client.js'), false)
})

for (const path of ['/pedidos', '/pedidos/controle-da-tv']) test(`App refreshes current orders on the two-second cadence and focus at ${path}`, async t => {
  const h = await workspaceHarness(t)
  let orderReads = 0
  globalThis.fetch = async url => {
    let payload
    if (url === '/api/auth/session') payload = authenticatedSession
    else if (url === '/api/orders') { orderReads++; payload = { orders: [] } }
    else if (url === '/api/bootstrap') payload = { business: { id: 'amor-e-sabor' }, orders: [], clients: [], products: [], tables: [], tableTabs: [], movements: [] }
    else if (url === '/api/printing/stations') payload = { stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }] }
    else if (String(url).startsWith('/api/printing/jobs?')) payload = { jobs: [] }
    else if (url === '/api/printing/jobs/summary') payload = { summary: {} }
    else throw new Error(`Unexpected request: ${url}`)
    return { ok: true, json: async () => payload }
  }
  const { default: App } = await h.load('/src/App.jsx')
  const { router } = await h.renderAdminApp(App, {}, { initialEntries: [path] })
  assert.equal(router.state.location.pathname, path)
  const initial = orderReads
  await act(async () => h.fireInterval(2000))
  assert.equal(orderReads, initial + 1)
  await act(async () => h.window.dispatchEvent(new Event('focus')))
  assert.equal(orderReads, initial + 2)
})

test('kitchen UI supports one-time visual alerts and a persisted sound toggle', () => {
  const app = read('src/App.jsx')
  const storage = read('src/infrastructure/storage/kitchenSoundPreference.js')
  const arrivals = read('src/domains/orders/application/useOrderArrivals.js')
  const orders = read('src/domains/orders/ui/Orders.jsx')
  const css = read('src/order-operations.css')
  assert.match(storage, /kitchen-sound-enabled/)
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
