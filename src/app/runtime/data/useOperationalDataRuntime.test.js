import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import {
  GLOBAL_SYNC_INTERVAL_MS,
  ORDER_SYNC_INTERVAL_MS,
  createRefreshSubscription,
  useOperationalDataRuntime,
} from './useOperationalDataRuntime.js'

const bootstrapFixture = () => ({
  clients: [{ id: 'client-1', name: 'Ana' }],
  products: [{ id: 'product-1', name: 'Marmita' }],
  orders: [{ id: 'order-1', status: 'Em preparo' }],
  tables: [{ id: 'table-1', occupancy: 'occupied', openTableTab: { id: 'tab-1' } }],
  tableTabs: [{ id: 'tab-1', status: 'open' }],
  movements: [{ id: 'movement-1', type: 'entrada', value: 10 }],
  financeSettings: { openingBalance: 20 },
  effectiveBusinessConfig: { version: 'cfg-1', revisions: {} },
})

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

function createHarness({
  api,
  legacyBridges = {},
  onUnauthorized = () => {},
  globalSyncEnabled = false,
  ordersSyncEnabled = false,
  effectiveConfigVersion = null,
} = {}) {
  let current
  const Harness = () => {
    current = useOperationalDataRuntime({
      api,
      legacyBridges,
      onUnauthorized,
      globalSyncEnabled,
      ordersSyncEnabled,
      effectiveConfigVersion,
    })
    return null
  }
  return { Harness, getCurrent: () => current }
}

async function mountHarness(t, options) {
  const harness = createHarness(options)
  let renderer
  await act(async () => { renderer = create(React.createElement(harness.Harness)) })
  t.after(() => renderer.unmount())
  return harness
}

test('createRefreshSubscription runs immediately, reacts to visible/focus, and cleans up', () => {
  let runCount = 0
  let intervalCallback
  let clearIntervalCalls = 0
  const removedEventNames = []
  const windowListeners = new Map()
  const documentListeners = new Map()
  const windowObject = {
    addEventListener(name, listener) { windowListeners.set(name, listener) },
    removeEventListener(name) { removedEventNames.push(name); windowListeners.delete(name) },
  }
  const documentObject = {
    visibilityState: 'visible',
    addEventListener(name, listener) { documentListeners.set(name, listener) },
    removeEventListener(name) { removedEventNames.push(name); documentListeners.delete(name) },
  }

  assert.equal(GLOBAL_SYNC_INTERVAL_MS, 5000)
  assert.equal(ORDER_SYNC_INTERVAL_MS, 2000)

  const unsubscribe = createRefreshSubscription({
    run: () => { runCount += 1 },
    intervalMs: GLOBAL_SYNC_INTERVAL_MS,
    windowObject,
    documentObject,
    setIntervalFn(callback) { intervalCallback = callback; return 'timer-1' },
    clearIntervalFn(token) { assert.equal(token, 'timer-1'); clearIntervalCalls += 1 },
  })

  assert.equal(runCount, 1)
  intervalCallback()
  assert.equal(runCount, 2)
  documentObject.visibilityState = 'hidden'
  intervalCallback()
  assert.equal(runCount, 2)
  documentObject.visibilityState = 'visible'
  documentListeners.get('visibilitychange')()
  windowListeners.get('focus')()
  assert.equal(runCount, 4)
  unsubscribe()
  assert.equal(clearIntervalCalls, 1)
  assert.deepEqual(removedEventNames.sort(), ['focus', 'visibilitychange'])
})

test('refreshBootstrap loads every official collection and effective config', async (t) => {
  const bootstrap = bootstrapFixture()
  const harness = await mountHarness(t, {
    api: {
      getBootstrap: async () => bootstrap,
      getOrders: async () => ({ orders: [] }),
    },
  })

  await act(async () => { await harness.getCurrent().refreshBootstrap() })
  const current = harness.getCurrent()
  assert.equal(current.bootstrapState, 'ready')
  assert.deepEqual(current.bootstrapEffectiveConfig, bootstrap.effectiveBusinessConfig)
  assert.deepEqual(current.clients, bootstrap.clients)
  assert.deepEqual(current.products, bootstrap.products)
  assert.deepEqual(current.orders, bootstrap.orders)
  assert.deepEqual(current.tables, bootstrap.tables)
  assert.deepEqual(current.tableTabs, bootstrap.tableTabs)
  assert.deepEqual(current.movements, bootstrap.movements)
  assert.deepEqual(current.financeSettings, bootstrap.financeSettings)
})

test('a stale bootstrap cannot overwrite a newer official mutation', async (t) => {
  const pending = deferred()
  const harness = await mountHarness(t, {
    api: {
      getBootstrap: async () => pending.promise,
      getOrders: async () => ({ orders: [] }),
    },
  })

  let refreshPromise
  await act(async () => {
    refreshPromise = harness.getCurrent().refreshBootstrapSilently()
  })
  await act(async () => {
    harness.getCurrent().applyOfficialEffects({ order: { id: 'order-1', status: 'Finalizado' } })
  })
  pending.resolve(bootstrapFixture())
  await act(async () => { await refreshPromise })

  assert.equal(harness.getCurrent().orders[0].status, 'Finalizado')
})

test('bootstrap uses the payment-owner snapshot captured when the read starts', async (t) => {
  const ownerA = { id: 'owner-a' }
  const ownerB = { id: 'owner-b' }
  let captureResult = [ownerA]
  const settlements = []
  const pending = deferred()
  const harness = await mountHarness(t, {
    api: {
      getBootstrap: async () => pending.promise,
      getOrders: async () => ({ orders: [] }),
    },
    legacyBridges: {
      capturePaymentOwners: () => captureResult,
      settlePaymentOwners: (owners, receipt) => settlements.push({ owners, receipt }),
    },
  })

  let refreshPromise
  await act(async () => { refreshPromise = harness.getCurrent().refreshBootstrapSilently() })
  captureResult = [ownerB]
  pending.resolve(bootstrapFixture())
  await act(async () => { await refreshPromise })

  assert.equal(settlements.length, 1)
  assert.deepEqual(settlements[0].owners, [ownerA])
  assert.ok(settlements[0].receipt.applied.includes('orders'))
})

test('table commits notify the bridge and update the official tables snapshot', async (t) => {
  const bootstrap = bootstrapFixture()
  const committed = []
  const harness = await mountHarness(t, {
    api: {
      getBootstrap: async () => bootstrap,
      getOrders: async () => ({ orders: [] }),
    },
    legacyBridges: {
      onTablesCommitted: (tables) => committed.push(tables),
    },
  })

  await act(async () => { await harness.getCurrent().refreshBootstrap() })
  assert.strictEqual(committed.at(-1), bootstrap.tables)
  assert.deepEqual(harness.getCurrent().getOfficialTables().map(({ id }) => id), ['table-1'])
})

test('refreshOrders changes only orders', async (t) => {
  const bootstrap = bootstrapFixture()
  const nextOrders = [{ id: 'order-2', status: 'Em preparo' }]
  const harness = await mountHarness(t, {
    api: {
      getBootstrap: async () => bootstrap,
      getOrders: async () => ({ orders: nextOrders }),
    },
  })

  await act(async () => { await harness.getCurrent().refreshBootstrap() })
  const before = harness.getCurrent()
  const previousClients = before.clients
  const previousProducts = before.products
  const previousTables = before.tables
  const previousTableTabs = before.tableTabs
  const previousMovements = before.movements
  const previousFinanceSettings = before.financeSettings

  await act(async () => { await harness.getCurrent().refreshOrders() })
  const current = harness.getCurrent()
  assert.deepEqual(current.orders, nextOrders)
  assert.strictEqual(current.clients, previousClients)
  assert.strictEqual(current.products, previousProducts)
  assert.strictEqual(current.tables, previousTables)
  assert.strictEqual(current.tableTabs, previousTableTabs)
  assert.strictEqual(current.movements, previousMovements)
  assert.strictEqual(current.financeSettings, previousFinanceSettings)
})

test('resetOperationalData clears official state, replaces the guard, and resets revision', async (t) => {
  const bootstrap = bootstrapFixture()
  const harness = await mountHarness(t, {
    api: {
      getBootstrap: async () => bootstrap,
      getOrders: async () => ({ orders: [] }),
    },
  })

  await act(async () => { await harness.getCurrent().refreshBootstrap() })
  const firstGuard = harness.getCurrent().getSyncGuard()
  await act(async () => { harness.getCurrent().resetOperationalData() })
  const current = harness.getCurrent()

  assert.equal(current.bootstrapState, 'idle')
  assert.equal(current.bootstrapEffectiveConfig, null)
  assert.deepEqual(current.clients, [])
  assert.deepEqual(current.products, [])
  assert.deepEqual(current.orders, [])
  assert.deepEqual(current.tables, [])
  assert.deepEqual(current.tableTabs, [])
  assert.deepEqual(current.movements, [])
  assert.equal(current.financeSettings, null)
  assert.notStrictEqual(current.getSyncGuard(), firstGuard)
  assert.equal(current.getOfficialRevision(), 0)
  assert.deepEqual(current.getOfficialTables(), [])
})
