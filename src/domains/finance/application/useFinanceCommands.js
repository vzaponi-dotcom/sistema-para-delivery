import { useCallback, useState } from 'react'
import { financeApi } from '../infrastructure/financeApi.js'

const initialMovementDialog = Object.freeze({ open: false, movement: null })

export function useFinanceCommands({
  api = financeApi,
  applyOfficialEffects = () => {},
  writesBlocked = false,
  canManageMovements = false,
  setRequestKey = () => {},
  onSuccess = () => {},
  onError = () => {},
} = {}) {
  const [movementDialog, setMovementDialog] = useState(initialMovementDialog)
  const [openingBalanceOpen, setOpeningBalanceOpen] = useState(false)

  const openNewMovement = useCallback(() => {
    if (!canManageMovements || writesBlocked) return false
    setMovementDialog({ open: true, movement: null })
    return true
  }, [canManageMovements, writesBlocked])

  const openEditMovement = useCallback((movement) => {
    if (!canManageMovements || writesBlocked || movement?.source !== 'manual') return false
    setMovementDialog({ open: true, movement })
    return true
  }, [canManageMovements, writesBlocked])

  const closeMovementDialog = useCallback(() => {
    setMovementDialog({ open: false, movement: null })
  }, [])

  const saveMovement = useCallback(async (payload) => {
    if (!canManageMovements || writesBlocked) return false
    const movementId = movementDialog.movement?.id ?? null
    setRequestKey(movementId ? `movement:update:${movementId}` : 'movement:create')
    try {
      const { movement } = movementId
        ? await api.updateMovement(movementId, payload)
        : await api.createMovement(payload)
      applyOfficialEffects({ movement })
      onSuccess(movementId ? 'Movimentação atualizada com sucesso' : 'Movimentação registrada com sucesso')
      return true
    } catch (error) {
      onError(error)
      return false
    } finally {
      setRequestKey(null)
    }
  }, [api, applyOfficialEffects, canManageMovements, movementDialog.movement, onError, onSuccess, setRequestKey, writesBlocked])

  const deleteMovement = useCallback(async (movementId) => {
    if (!canManageMovements || writesBlocked) return false
    setRequestKey(`movement:delete:${movementId}`)
    try {
      const { deletedMovementId } = await api.deleteMovement(movementId)
      applyOfficialEffects({ deletedMovementId })
      onSuccess('Movimentação excluída com sucesso')
      return true
    } catch (error) {
      onError(error)
      return false
    } finally {
      setRequestKey(null)
    }
  }, [api, applyOfficialEffects, canManageMovements, onError, onSuccess, setRequestKey, writesBlocked])

  const openOpeningBalance = useCallback(() => {
    if (!canManageMovements || writesBlocked) return false
    setOpeningBalanceOpen(true)
    return true
  }, [canManageMovements, writesBlocked])

  const closeOpeningBalance = useCallback(() => {
    setOpeningBalanceOpen(false)
  }, [])

  const saveOpeningBalance = useCallback(async (payload) => {
    if (!canManageMovements || writesBlocked) return false
    setRequestKey('finance-settings:save')
    try {
      const { financeSettings } = await api.saveFinanceSettings(payload)
      applyOfficialEffects({ financeSettings })
      onSuccess('Saldo inicial atualizado com sucesso')
      return true
    } catch (error) {
      onError(error)
      return false
    } finally {
      setRequestKey(null)
    }
  }, [api, applyOfficialEffects, canManageMovements, onError, onSuccess, setRequestKey, writesBlocked])

  return {
    movementDialog,
    openingBalanceOpen,
    openNewMovement,
    openEditMovement,
    closeMovementDialog,
    saveMovement,
    deleteMovement,
    openOpeningBalance,
    closeOpeningBalance,
    saveOpeningBalance,
  }
}
