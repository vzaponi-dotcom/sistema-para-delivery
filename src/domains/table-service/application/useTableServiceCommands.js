import { useCallback } from 'react'
import { validateTransferIntent } from '../domain/tableTransfer.js'
import { tableServiceApi } from '../infrastructure/tableServiceApi.js'

const successMessages = Object.freeze({
  create: 'Mesa adicionada com sucesso',
  rename: 'Mesa renomeada com sucesso',
  activate: 'Mesa ativada com sucesso',
  deactivate: 'Mesa desativada com sucesso',
  transfer: 'Comanda transferida com sucesso',
})

export function useTableServiceCommands({
  api = tableServiceApi,
  getOfficialTables = () => [],
  applyOfficialEffects = () => {},
  refreshOfficialData = async () => false,
  writesBlocked = false,
  canManageTables = false,
  canTransfer = false,
  setRequestKey = () => {},
  onSuccess = () => {},
  onError = () => {},
  onStaleTarget = () => {},
} = {}) {
  const createTable = useCallback(async (name) => {
    if (!canManageTables || writesBlocked) return false
    setRequestKey('table:create')
    try {
      const result = await api.createTable({ name })
      applyOfficialEffects({ tables: result.tables })
      onSuccess(successMessages.create)
      return true
    } catch (error) {
      onError(error)
      return false
    } finally {
      setRequestKey(null)
    }
  }, [api, applyOfficialEffects, canManageTables, onError, onSuccess, setRequestKey, writesBlocked])

  const renameTable = useCallback(async (tableId, name) => {
    if (!canManageTables || writesBlocked) return false
    setRequestKey(`table:rename:${tableId}`)
    try {
      const result = await api.updateTable(tableId, { name })
      applyOfficialEffects({ tables: result.tables })
      onSuccess(successMessages.rename)
      return true
    } catch (error) {
      onError(error)
      return false
    } finally {
      setRequestKey(null)
    }
  }, [api, applyOfficialEffects, canManageTables, onError, onSuccess, setRequestKey, writesBlocked])

  const setTableActive = useCallback(async (tableId, isActive) => {
    if (!canManageTables || writesBlocked) return false
    setRequestKey(`table:active:${tableId}`)
    try {
      const result = await api.updateTable(tableId, { isActive })
      applyOfficialEffects({ tables: result.tables })
      onSuccess(isActive ? successMessages.activate : successMessages.deactivate)
      return true
    } catch (error) {
      onError(error)
      return false
    } finally {
      setRequestKey(null)
    }
  }, [api, applyOfficialEffects, canManageTables, onError, onSuccess, setRequestKey, writesBlocked])

  const reorderTables = useCallback(async (tableIds) => {
    if (!canManageTables || writesBlocked) return false
    setRequestKey('table:reorder')
    try {
      const result = await api.reorderTables(tableIds)
      applyOfficialEffects({ tables: result.tables })
      return true
    } catch (error) {
      onError(error)
      return false
    } finally {
      setRequestKey(null)
    }
  }, [api, applyOfficialEffects, canManageTables, onError, setRequestKey, writesBlocked])

  const transferTableTab = useCallback(async (sourceTableId, destinationTableId, expectedTableTabId) => {
    if (writesBlocked || !canTransfer) return false

    const validated = validateTransferIntent(getOfficialTables(), {
      sourceTableId,
      destinationTableId,
      expectedTableTabId,
    })
    if (!validated) {
      onStaleTarget('A comanda ou a mesa de destino mudou. Atualizamos a consulta.')
      void refreshOfficialData()
      return false
    }

    setRequestKey(`table:transfer:${sourceTableId}`)
    try {
      const result = await api.transferTableTab(sourceTableId, destinationTableId, expectedTableTabId)
      applyOfficialEffects({ tables: result.tables, tableTab: result.tableTab })
      onSuccess(successMessages.transfer)
      return true
    } catch (error) {
      if (error?.status === 409) await refreshOfficialData()
      onError(error)
      return false
    } finally {
      setRequestKey(null)
    }
  }, [
    api,
    applyOfficialEffects,
    canTransfer,
    getOfficialTables,
    onError,
    onStaleTarget,
    onSuccess,
    refreshOfficialData,
    setRequestKey,
    writesBlocked,
  ])

  return {
    createTable,
    renameTable,
    setTableActive,
    reorderTables,
    transferTableTab,
  }
}
