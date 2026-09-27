import { useCallback, useState } from 'react'

const normalizeOrderIds = (values = []) => [...new Set(
  (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean),
)]

const emptyState = () => ({
  activeGroupKey: null,
  visibleOrderIds: [],
  selectedOrderIds: [],
})

export function useReceivableClientSelection() {
  const [state, setState] = useState(emptyState)

  const activateGroup = useCallback((groupKey, orderIds = []) => {
    const key = typeof groupKey === 'string' ? groupKey.trim() : ''
    if (!key) {
      setState(emptyState())
      return false
    }
    const visibleOrderIds = normalizeOrderIds(orderIds)
    setState((current) => {
      if (current.activeGroupKey !== key) {
        return { activeGroupKey: key, visibleOrderIds, selectedOrderIds: [] }
      }
      const visible = new Set(visibleOrderIds)
      return {
        activeGroupKey: key,
        visibleOrderIds,
        selectedOrderIds: current.selectedOrderIds.filter((id) => visible.has(id)),
      }
    })
    return true
  }, [])

  const toggleOrder = useCallback((orderId) => {
    const id = typeof orderId === 'string' ? orderId.trim() : ''
    if (!id || !state.activeGroupKey || !state.visibleOrderIds.includes(id)) return false
    setState((current) => ({
      ...current,
      selectedOrderIds: current.selectedOrderIds.includes(id)
        ? current.selectedOrderIds.filter((value) => value !== id)
        : [...current.selectedOrderIds, id],
    }))
    return true
  }, [state.activeGroupKey, state.visibleOrderIds])

  const selectAllVisible = useCallback(() => {
    if (!state.activeGroupKey) return false
    setState((current) => ({ ...current, selectedOrderIds: [...current.visibleOrderIds] }))
    return true
  }, [state.activeGroupKey])

  const deselectAll = useCallback(() => {
    setState((current) => ({ ...current, selectedOrderIds: [] }))
    return true
  }, [])

  const reconcile = useCallback((groupKey, orderIds = []) => {
    const key = typeof groupKey === 'string' ? groupKey.trim() : ''
    const visibleOrderIds = normalizeOrderIds(orderIds)
    if (!key || key !== state.activeGroupKey) {
      setState(emptyState())
      return false
    }
    const visible = new Set(visibleOrderIds)
    setState((current) => ({
      activeGroupKey: current.activeGroupKey,
      visibleOrderIds,
      selectedOrderIds: current.selectedOrderIds.filter((id) => visible.has(id)),
    }))
    return true
  }, [state.activeGroupKey])

  const clear = useCallback(() => {
    setState(emptyState())
    return true
  }, [])

  return {
    activeGroupKey: state.activeGroupKey,
    visibleOrderIds: state.visibleOrderIds,
    selectedOrderIds: state.selectedOrderIds,
    selectedCount: state.selectedOrderIds.length,
    activateGroup,
    toggleOrder,
    selectAllVisible,
    deselectAll,
    reconcile,
    clear,
  }
}
