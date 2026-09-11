import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('./App.jsx', import.meta.url), 'utf8')

test('app wires per-collection guards for global and orders synchronization', () => {
  assert.match(app, /createCollectionSyncGuard/)
  assert.match(app, /const DATA_COLLECTIONS = \['clients', 'products', 'orders', 'tables', 'tableTabs', 'movements', 'financeSettings'\]/)
  assert.match(app, /const GLOBAL_SYNC_INTERVAL_MS = 5_000/)
  assert.match(app, /const ORDER_SYNC_INTERVAL_MS = 2_000/)
  assert.match(app, /bootstrapSyncInFlightRef/)
  assert.match(app, /ordersSyncInFlightRef/)
  assert.match(app, /beginRead\(DATA_COLLECTIONS\)/)
  assert.match(app, /beginRead\(\['orders'\]\)/)
  assert.match(app, /canApply\(token, 'orders'\)/)
})

test('global sync is silent and reacts to interval visibility focus and reconnect', () => {
  assert.match(app, /refreshBootstrapSilently/)
  assert.match(app, /window\.setInterval\([\s\S]*GLOBAL_SYNC_INTERVAL_MS/s)
  assert.match(app, /document\.addEventListener\('visibilitychange'/)
  assert.match(app, /window\.addEventListener\('focus'/)
  assert.match(app, /window\.addEventListener\('online'/)
  assert.match(app, /if \(document\.visibilityState === 'visible'\) void refreshBootstrapSilently\(\)/)
})

test('orders keep the faster cadence and stale order reads cannot overwrite newer state', () => {
  assert.match(app, /getOrders as getOrdersApi/)
  assert.match(app, /ORDER_SYNC_INTERVAL_MS/)
  assert.match(app, /ordersSyncInFlightRef\.current/)
  assert.match(app, /canApply\(token, 'orders'\)/)
})

test('paid checkout applies authoritative effects locally instead of awaiting full bootstrap', () => {
  assert.match(app, /const \{ order, movement, tableTab, tables: nextTables \} = await createOrderApi/)
  assert.doesNotMatch(app, /if \(order\.paymentStatus === 'Pago'\) await refreshBootstrap\(\)/)
  assert.match(app, /markMutation/)
  assert.match(app, /upsertById/)
})
