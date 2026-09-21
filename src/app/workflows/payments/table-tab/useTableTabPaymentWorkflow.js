import { useCallback, useEffect, useRef, useState } from 'react'
import { formatTableIdentifierLabel } from '../../../../domains/finance/index.js'
import { paymentApi } from '../paymentApi.js'
import { settleTableTabPayment } from './tableTabPaymentReconciliation.js'

export function useTableTabPaymentWorkflow({
  api = paymentApi,
  writesBlocked = false,
  selectionGeneration = 0,
  resetKey = 0,
  getOfficialTables = () => [],
  ownsSelection = () => false,
  clearSelection = () => false,
  getSyncGuard = () => null,
  getOfficialRevision = () => 0,
  applyOfficialEffects = () => ({ applied: [], data: {} }),
  refreshOfficialData = async () => false,
  setRequestKey = () => {},
  onSuccess = () => {},
  onError = () => {},
} = {}) {
  const activeOwnerRef = useRef(null)
  const acceptedOwnersRef = useRef(new Set())
  const [syncState, setSyncState] = useState(null)
  const [requestBusy, setRequestBusy] = useState(false)

  const publish = useCallback(() => {
    const pending = [...acceptedOwnersRef.current]
    const owner = pending.find((item) => item.syncStatus === 'error') || pending[0]
    setSyncState(owner ? { status: owner.syncStatus, tableId: owner.tableId, tabId: owner.tabId } : null)
  }, [])

  const isLive = useCallback((owner) => Boolean(
    owner
    && owner.guard === getSyncGuard()
    && acceptedOwnersRef.current.has(owner)
  ), [getSyncGuard])

  const trySettle = useCallback((owner, receipt) => {
    if (!isLive(owner)) return false
    const result = settleTableTabPayment(owner, receipt)
    if (!result.settled) return false

    owner.settled = true
    acceptedOwnersRef.current.delete(owner)
    publish()

    if (!result.replaced && ownsSelection(owner, result.nextTables)) {
      clearSelection()
      const accepted = Array.isArray(owner.result?.allocations) ? owner.result.allocations : []
      const suffix = accepted.length === 1
        ? ' via ' + accepted[0].methodLabel
        : ' em ' + accepted.length + ' formas'
      onSuccess('Pagamento de ' + formatTableIdentifierLabel(owner.tableIdentifier) + ' recebido' + suffix)
    }
    return true
  }, [clearSelection, isLive, onSuccess, ownsSelection, publish])

  const reconcileOwner = useCallback(async (owner) => {
    if (!isLive(owner)) return false
    owner.syncStatus = 'syncing'
    publish()

    const firstReceipt = await refreshOfficialData()
    if (trySettle(owner, firstReceipt)) return true
    if (!isLive(owner)) return false

    const secondReceipt = await refreshOfficialData()
    if (trySettle(owner, secondReceipt)) return true
    if (!isLive(owner)) return false

    owner.syncStatus = 'error'
    publish()
    return false
  }, [isLive, publish, refreshOfficialData, trySettle])

  const pay = useCallback(async (tableTabId, allocations, intent) => {
    const currentTables = getOfficialTables()
    const selected = currentTables.find((table) => (
      table.id === intent?.tableId
      && table.isActive
      && table.occupancy === 'occupied'
      && table.openTableTab?.id === tableTabId
      && tableTabId === intent?.tableTabId
    ))

    if (
      writesBlocked
      || activeOwnerRef.current
      || acceptedOwnersRef.current.size
      || !intent
      || !Array.isArray(allocations)
      || allocations.length === 0
      || !ownsSelection(intent, currentTables)
      || !selected
    ) return false

    const guard = getSyncGuard()
    const revision = getOfficialRevision()
    const owner = {
      guard,
      selectionGeneration: intent.selectionGeneration,
      tableId: intent.tableId,
      tableTabId: intent.tableTabId,
      tabId: intent.tableTabId,
      allocations: allocations.map((allocation) => ({ ...allocation })),
      requestKey: 'table-tab:payment:' + tableTabId,
      settled: false,
    }

    activeOwnerRef.current = owner
    setRequestBusy(true)
    setRequestKey(owner.requestKey)

    const ownsRequest = () => getSyncGuard() === guard && activeOwnerRef.current === owner

    try {
      const result = await api.registerTableTabPayment(tableTabId, owner.allocations)
      if (getSyncGuard() !== guard) return false

      owner.paid = true
      owner.result = result
      owner.tableIdentifier = result.tableTab?.tableIdentifier
      owner.syncStatus = 'syncing'
      acceptedOwnersRef.current.add(owner)
      publish()

      if (revision === getOfficialRevision()) {
        const receipt = applyOfficialEffects({
          orders: result.orders,
          movements: result.movements,
          tableTab: result.tableTab,
          tables: result.tables,
        })
        trySettle(owner, receipt)
      }

      if (!owner.settled) await reconcileOwner(owner)
      return true
    } catch (error) {
      if (!ownsRequest() || !ownsSelection(owner)) return false
      onError(error)
      if (error?.status === 409 && ownsRequest()) {
        await refreshOfficialData()
        if (ownsRequest()) await refreshOfficialData()
      }
      return false
    } finally {
      if (activeOwnerRef.current === owner) {
        activeOwnerRef.current = null
        setRequestBusy(false)
        setRequestKey((current) => current === owner.requestKey ? null : current)
      }
    }
  }, [
    api,
    applyOfficialEffects,
    getOfficialRevision,
    getOfficialTables,
    getSyncGuard,
    onError,
    ownsSelection,
    publish,
    reconcileOwner,
    refreshOfficialData,
    setRequestKey,
    trySettle,
    writesBlocked,
  ])

  const retrySync = useCallback(async () => {
    const pending = [...acceptedOwnersRef.current]
    if (!pending.length) return false
    const results = await Promise.all(pending.map((owner) => reconcileOwner(owner)))
    return results.every(Boolean)
  }, [reconcileOwner])

  useEffect(() => {
    const owner = activeOwnerRef.current
    if (!owner || owner.selectionGeneration === selectionGeneration) return
    activeOwnerRef.current = null
    setRequestBusy(false)
    setRequestKey((current) => current === owner.requestKey ? null : current)
  }, [selectionGeneration, setRequestKey])

  useEffect(() => {
    const owner = activeOwnerRef.current
    if (owner) setRequestKey((current) => current === owner.requestKey ? null : current)
    activeOwnerRef.current = null
    acceptedOwnersRef.current = new Set()
    setRequestBusy(false)
    setSyncState(null)
  }, [resetKey, setRequestKey])

  return {
    pay,
    syncState,
    retrySync,
    busy: requestBusy || Boolean(syncState),
  }
}
