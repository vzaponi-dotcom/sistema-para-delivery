import { useCallback, useEffect, useRef, useState } from 'react'
import {
  reconcileComandaSelection,
  resolveOpenComanda,
  sameComandaIdentity,
} from '../domain/comandaIdentity.js'

export function useComandaSelection({ tables = [] } = {}) {
  const tablesRef = useRef(tables)
  const selectionRef = useRef(null)
  const generationRef = useRef(0)
  const [selection, setSelection] = useState(null)
  const [selectionGeneration, setSelectionGeneration] = useState(0)
  tablesRef.current = tables

  const publish = useCallback((nextSelection, { advanceGeneration }) => {
    if (advanceGeneration) generationRef.current += 1
    selectionRef.current = nextSelection
    setSelection(nextSelection)
    setSelectionGeneration(generationRef.current)
  }, [])

  const selectComanda = useCallback((target, sourceTables = tablesRef.current) => {
    const resolved = resolveOpenComanda(sourceTables, target)
    if (!resolved) return false
    publish(resolved, { advanceGeneration: true })
    return true
  }, [publish])

  const clearComandaSelection = useCallback(() => {
    if (!selectionRef.current) return false
    publish(null, { advanceGeneration: true })
    return true
  }, [publish])

  const resetComandaSelection = useCallback(() => {
    publish(null, { advanceGeneration: true })
  }, [publish])

  const ownsComandaSelection = useCallback((owner, sourceTables = null) => {
    const ownsCurrent = Boolean(
      owner
      && owner.selectionGeneration === generationRef.current
      && owner.tableId === selectionRef.current?.tableId
      && owner.tableTabId === selectionRef.current?.tableTabId
    )
    if (!ownsCurrent || !Array.isArray(sourceTables)) return ownsCurrent
    return Boolean(resolveOpenComanda(sourceTables, {
      tableId: owner.tableId,
      tableTabId: owner.tableTabId,
    }))
  }, [])

  const getComandaSelectionOwner = useCallback(() => selectionRef.current ? {
    ...selectionRef.current,
    selectionGeneration: generationRef.current,
  } : null, [])

  useEffect(() => {
    const current = selectionRef.current
    if (!current) return
    const reconciled = reconcileComandaSelection(tables, current)
    if (!reconciled) {
      publish(null, { advanceGeneration: true })
      return
    }
    if (!sameComandaIdentity(current, reconciled)) {
      publish(reconciled, { advanceGeneration: false })
    }
  }, [publish, tables])

  return {
    selection,
    selectionGeneration,
    selectComanda,
    clearComandaSelection,
    resetComandaSelection,
    ownsComandaSelection,
    getComandaSelectionOwner,
  }
}
