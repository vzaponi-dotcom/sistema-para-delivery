import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getBootstrap } from '../../../api/client.js'
import { ordersApi } from '../../../domains/orders/index.js'
import { createCollectionSyncGuard, removeById, upsertById, upsertManyById } from '../../../utils/dataSync.js'

export const GLOBAL_SYNC_INTERVAL_MS = 5_000
export const ORDER_SYNC_INTERVAL_MS = 2_000

const DATA_COLLECTIONS = ['clients', 'products', 'orders', 'tables', 'tableTabs', 'movements', 'financeSettings']
const PAYMENT_COLLECTIONS = ['orders', 'movements', 'tableTabs', 'tables']

const defaultApi = { getBootstrap, getOrders: ordersApi.getOrders }
export const createRefreshSubscription = ({
  run,
  intervalMs,
  windowObject = globalThis.window,
  documentObject = globalThis.document,
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
}) => {
  let cancelled = false
  const refresh = () => {
    if (!cancelled) void run()
  }
  const refreshWhenVisible = () => {
    if (documentObject?.visibilityState === 'visible') refresh()
  }

  refresh()
  const timer = setIntervalFn(refreshWhenVisible, intervalMs)
  const handleVisibilityChange = () => refreshWhenVisible()
  const handleFocus = () => refresh()
  documentObject?.addEventListener?.('visibilitychange', handleVisibilityChange)
  windowObject?.addEventListener?.('focus', handleFocus)

  return () => {
    cancelled = true
    clearIntervalFn(timer)
    documentObject?.removeEventListener?.('visibilitychange', handleVisibilityChange)
    windowObject?.removeEventListener?.('focus', handleFocus)
  }
}

const readEffectiveConfigVersion = (value) => typeof value === 'function' ? value() : value

export function useOperationalDataRuntime({
  api = defaultApi,
  onUnauthorized = () => {},
  globalSyncEnabled = false,
  ordersSyncEnabled = false,
  effectiveConfigVersion = null,
} = {}) {
  const [bootstrapEffectiveConfig, setBootstrapEffectiveConfig] = useState(null)
  const [bootstrapState, setBootstrapState] = useState('idle')
  const [products, setProducts] = useState([])
  const [clients, setClients] = useState([])
  const [orders, setOrders] = useState([])
  const [tables, setTables] = useState([])
  const [tableTabs, setTableTabs] = useState([])
  const [movements, setMovements] = useState([])
  const [financeSettings, setFinanceSettings] = useState(null)

  const syncGuardRef = useRef(createCollectionSyncGuard(DATA_COLLECTIONS))
  const bootstrapSyncInFlightRef = useRef(false)
  const ordersSyncInFlightRef = useRef(false)
  const officialRevisionRef = useRef(0)
  const officialTablesRef = useRef([])
  const effectiveConfigVersionRef = useRef(effectiveConfigVersion)
  const onUnauthorizedRef = useRef(onUnauthorized)
  const apiRef = useRef(api)

  useEffect(() => { effectiveConfigVersionRef.current = effectiveConfigVersion }, [effectiveConfigVersion])
  useEffect(() => { onUnauthorizedRef.current = onUnauthorized }, [onUnauthorized])
  useEffect(() => { apiRef.current = api }, [api])

  const commitTables = useCallback((nextTables) => {
    officialTablesRef.current = nextTables
    setTables(nextTables)
  }, [])

  const applyBootstrapCollections = useCallback((data, token) => {
    const guard = syncGuardRef.current
    const receipt = {
      data,
      applied: PAYMENT_COLLECTIONS.filter((key) => Array.isArray(data?.[key]) && guard.canApply(token, key)),
    }
    if (PAYMENT_COLLECTIONS.some((key) => guard.canApply(token, key))) officialRevisionRef.current += 1
    if (guard.canApply(token, 'clients')) setClients(Array.isArray(data?.clients) ? data.clients : [])
    if (guard.canApply(token, 'products')) setProducts(Array.isArray(data?.products) ? data.products : [])
    if (guard.canApply(token, 'orders')) setOrders(Array.isArray(data?.orders) ? data.orders : [])
    if (guard.canApply(token, 'tables')) commitTables(Array.isArray(data?.tables) ? data.tables : [])
    if (guard.canApply(token, 'tableTabs')) setTableTabs(Array.isArray(data?.tableTabs) ? data.tableTabs : [])
    if (guard.canApply(token, 'movements')) setMovements(Array.isArray(data?.movements) ? data.movements : [])
    if (guard.canApply(token, 'financeSettings')) setFinanceSettings(data?.financeSettings ?? null)
    if (data?.effectiveBusinessConfig) setBootstrapEffectiveConfig(data.effectiveBusinessConfig)
    return receipt
  }, [commitTables])

  const applyOfficialEffects = useCallback(({
    order,
    orders: nextOrders,
    movement,
    movements: nextMovements,
    deletedMovementId,
    financeSettings: nextFinanceSettings,
    table,
    tables: nextTables,
    tableTab,
    client,
    deletedClientId,
    product,
    deletedProductId,
  }) => {
    const changed = []
    if (order || Array.isArray(nextOrders)) changed.push('orders')
    if (movement || deletedMovementId || Array.isArray(nextMovements)) changed.push('movements')
    if (nextFinanceSettings !== undefined) changed.push('financeSettings')
    if (table || Array.isArray(nextTables)) changed.push('tables')
    if (tableTab) changed.push('tableTabs')
    if (client || deletedClientId) changed.push('clients')
    if (product || deletedProductId) changed.push('products')

    syncGuardRef.current.markMutation(changed)
    if (changed.some((key) => PAYMENT_COLLECTIONS.includes(key))) officialRevisionRef.current += 1
    if (order) setOrders((current) => upsertById(current, order))
    if (Array.isArray(nextOrders) && nextOrders.length) setOrders((current) => upsertManyById(current, nextOrders))
    if (movement) setMovements((current) => upsertById(current, movement))
    if (Array.isArray(nextMovements) && nextMovements.length) setMovements((current) => upsertManyById(current, nextMovements))
    if (deletedMovementId) setMovements((current) => removeById(current, deletedMovementId))
    if (nextFinanceSettings !== undefined) setFinanceSettings(nextFinanceSettings)
    if (table) commitTables(upsertById(officialTablesRef.current, table))
    if (Array.isArray(nextTables)) commitTables(nextTables)
    if (tableTab) setTableTabs((current) => upsertById(current, tableTab))
    if (client) setClients((current) => upsertById(current, client))
    if (deletedClientId) setClients((current) => removeById(current, deletedClientId))
    if (product) setProducts((current) => upsertById(current, product))
    if (deletedProductId) setProducts((current) => removeById(current, deletedProductId))

    return {
      applied: changed,
      data: {
        orders: nextOrders,
        movements: nextMovements,
        tableTabs: tableTab ? [tableTab] : undefined,
        tables: nextTables,
      },
    }
  }, [commitTables])

  const updateCollection = useCallback((collection, updater) => {
    if (collection === 'tables') {
      syncGuardRef.current.markMutation(['tables'])
      officialRevisionRef.current += 1
      const next = typeof updater === 'function' ? updater(officialTablesRef.current) : updater
      commitTables(next)
      return true
    }
    const setters = {
      clients: setClients,
      products: setProducts,
      orders: setOrders,
      tableTabs: setTableTabs,
      movements: setMovements,
      financeSettings: setFinanceSettings,
    }
    const setter = setters[collection]
    if (!setter) return false
    syncGuardRef.current.markMutation([collection])
    if (PAYMENT_COLLECTIONS.includes(collection)) officialRevisionRef.current += 1
    setter(updater)
    return true
  }, [commitTables])

  const refreshBootstrap = useCallback(({ background = false } = {}) => {
    if (bootstrapSyncInFlightRef.current) return bootstrapSyncInFlightRef.current
    const guard = syncGuardRef.current
    const token = guard.beginRead(DATA_COLLECTIONS)
    if (!background) setBootstrapState('loading')

    const read = async () => {
      try {
        const configVersion = readEffectiveConfigVersion(effectiveConfigVersionRef.current)
        const data = await apiRef.current.getBootstrap(background ? configVersion : undefined)
        if (guard !== syncGuardRef.current) return false
        const receipt = applyBootstrapCollections(data, token)
        if (!background) setBootstrapState('ready')
        return receipt
      } catch (error) {
        if (guard !== syncGuardRef.current) return false
        if (error?.status === 401) onUnauthorizedRef.current(error)
        else if (!background) setBootstrapState('error')
        return false
      } finally {
        if (guard === syncGuardRef.current) bootstrapSyncInFlightRef.current = false
      }
    }

    const pending = read()
    bootstrapSyncInFlightRef.current = pending
    return pending
  }, [applyBootstrapCollections])

  const refreshBootstrapSilently = useCallback(() => refreshBootstrap({ background: true }), [refreshBootstrap])

  const refreshOrders = useCallback(async () => {
    if (ordersSyncInFlightRef.current) return ordersSyncInFlightRef.current
    const guard = syncGuardRef.current
    const token = guard.beginRead(['orders'])
    const read = async () => {
      try {
        const data = await apiRef.current.getOrders()
        if (guard !== syncGuardRef.current || !Array.isArray(data?.orders) || !guard.canApply(token, 'orders')) return false
        officialRevisionRef.current += 1
        setOrders(data.orders)
        return data.orders
      } catch (error) {
        if (guard === syncGuardRef.current && error?.status === 401) onUnauthorizedRef.current(error)
        return false
      } finally {
        if (guard === syncGuardRef.current) ordersSyncInFlightRef.current = false
      }
    }
    const pending = read()
    ordersSyncInFlightRef.current = pending
    return pending
  }, [])

  const resetOperationalData = useCallback(() => {
    syncGuardRef.current = createCollectionSyncGuard(DATA_COLLECTIONS)
    bootstrapSyncInFlightRef.current = false
    ordersSyncInFlightRef.current = false
    officialRevisionRef.current = 0
    officialTablesRef.current = []
    setBootstrapEffectiveConfig(null)
    setBootstrapState('idle')
    setClients([])
    setProducts([])
    setOrders([])
    setTables([])
    setTableTabs([])
    setMovements([])
    setFinanceSettings(null)
  }, [])

  useEffect(() => {
    if (!globalSyncEnabled || bootstrapState !== 'ready') return undefined
    return createRefreshSubscription({
      run: refreshBootstrapSilently,
      intervalMs: GLOBAL_SYNC_INTERVAL_MS,
    })
  }, [bootstrapState, globalSyncEnabled, refreshBootstrapSilently])

  useEffect(() => {
    if (!ordersSyncEnabled || bootstrapState !== 'ready') return undefined
    return createRefreshSubscription({
      run: refreshOrders,
      intervalMs: ORDER_SYNC_INTERVAL_MS,
    })
  }, [bootstrapState, ordersSyncEnabled, refreshOrders])

  return useMemo(() => ({
    bootstrapState,
    bootstrapEffectiveConfig,
    clients,
    products,
    orders,
    tables,
    tableTabs,
    movements,
    financeSettings,
    refreshBootstrap,
    refreshBootstrapSilently,
    refreshOrders,
    applyOfficialEffects,
    updateCollection,
    resetOperationalData,
    getSyncGuard: () => syncGuardRef.current,
    getOfficialRevision: () => officialRevisionRef.current,
    getOfficialTables: () => officialTablesRef.current,
  }), [
    applyOfficialEffects,
    bootstrapEffectiveConfig,
    bootstrapState,
    clients,
    financeSettings,
    movements,
    orders,
    products,
    refreshBootstrap,
    refreshBootstrapSilently,
    refreshOrders,
    resetOperationalData,
    tableTabs,
    tables,
    updateCollection,
  ])
}
