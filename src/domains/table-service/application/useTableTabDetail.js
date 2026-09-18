import { useCallback, useEffect, useRef, useState } from 'react'
import { getTableTabDetail as legacyGetTableTabDetail } from '../../../api/client.js'

const legacyApi = Object.freeze({ getTableTabDetail: legacyGetTableTabDetail })
const emptySnapshot = Object.freeze({ detail: null, loading: false, error: null })

export function useTableTabDetail({
  selection,
  officialTables = [],
  api = legacyApi,
  onUnauthorized = () => {},
} = {}) {
  const apiRef = useRef(api)
  const onUnauthorizedRef = useRef(onUnauthorized)
  const ownerRef = useRef(null)
  const ownerGenerationRef = useRef(0)
  const refreshRef = useRef(async () => false)
  const [snapshot, setSnapshot] = useState(() => selection?.tableId && selection?.tableTabId
    ? { detail: null, loading: true, error: null }
    : emptySnapshot)

  apiRef.current = api
  onUnauthorizedRef.current = onUnauthorized

  const loadOwner = useCallback(async (owner) => {
    if (!owner || owner.retired || ownerRef.current !== owner) return false
    if (owner.inFlight) {
      owner.queued = true
      return false
    }

    owner.inFlight = true
    setSnapshot((current) => current.detail
      ? { ...current, error: null }
      : { detail: null, loading: true, error: null })

    try {
      const { tableTab } = await apiRef.current.getTableTabDetail(owner.selection.tableTabId)
      if (owner.retired || ownerRef.current !== owner) return false

      if (!tableTab
        || tableTab.id !== owner.selection.tableTabId
        || tableTab.status !== 'open'
        || tableTab.table?.id !== owner.selection.tableId) {
        throw new Error('Comanda indisponível, encerrada ou transferida. Atualize a consulta.')
      }

      setSnapshot({ detail: tableTab, loading: false, error: null })
      return true
    } catch (error) {
      if (owner.retired || ownerRef.current !== owner) return false

      setSnapshot((current) => current.detail
        ? { ...current, loading: false, error: null }
        : {
            detail: null,
            loading: false,
            error: error?.message || 'Não foi possível carregar a comanda.',
          })

      if (error?.status === 401) onUnauthorizedRef.current?.(error)
      return false
    } finally {
      owner.inFlight = false
      if (!owner.retired && ownerRef.current === owner && owner.queued) {
        owner.queued = false
        void loadOwner(owner)
      }
    }
  }, [])

  const tableId = selection?.tableId || ''
  const tableTabId = selection?.tableTabId || ''

  useEffect(() => {
    const previous = ownerRef.current
    if (previous) previous.retired = true

    if (!tableId || !tableTabId) {
      ownerRef.current = null
      refreshRef.current = async () => false
      setSnapshot(emptySnapshot)
      return undefined
    }

    const owner = {
      generation: ++ownerGenerationRef.current,
      selection: { tableId, tableTabId },
      inFlight: false,
      queued: false,
      retired: false,
    }
    ownerRef.current = owner
    refreshRef.current = () => loadOwner(owner)
    setSnapshot({ detail: null, loading: true, error: null })

    return () => {
      owner.retired = true
      if (ownerRef.current === owner) ownerRef.current = null
    }
  }, [loadOwner, tableId, tableTabId])

  useEffect(() => {
    if (!tableId || !tableTabId) return
    void refreshRef.current?.()
  }, [officialTables, tableId, tableTabId])

  const retry = useCallback(() => refreshRef.current?.() ?? Promise.resolve(false), [])

  return {
    detail: snapshot.detail,
    loading: snapshot.loading,
    error: snapshot.error,
    retry,
  }
}
