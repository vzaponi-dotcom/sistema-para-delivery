import { useCallback, useRef, useState } from 'react'
import { reservationMutationNeedsDiscount } from '../domain/tableReservation.js'
import { tableReservationApi } from '../infrastructure/tableReservationApi.js'

const messages = Object.freeze({
  edit: 'Reserva atualizada com sucesso',
  arrival: 'Chegada confirmada e comanda aberta',
  cancel: 'Reserva cancelada com sucesso',
  noShow: 'Não comparecimento registrado',
})

export function useTableReservationCommands({
  api = tableReservationApi,
  writesBlocked = false,
  canCreateOrders = false,
  canCancelOrders = false,
  canDiscountOrders = false,
  applyOfficialEffects = () => {},
  refreshReservation = async () => false,
  setRequestKey = () => {},
  onSuccess = () => {},
  onError = () => {},
  onResult = () => {},
} = {}) {
  const [actionKey, setActionKeyState] = useState(null)
  const actionRef = useRef(null)

  const setActionKey = useCallback((key) => {
    actionRef.current = key
    setActionKeyState(key)
    setRequestKey(key)
  }, [setRequestKey])

  const execute = useCallback(async ({
    key,
    allowed,
    call,
    successMessage,
    action,
  }) => {
    if (!allowed || writesBlocked || actionRef.current) return false
    setActionKey(key)
    try {
      const result = await call()
      applyOfficialEffects(result)
      onResult(result, action)
      onSuccess(successMessage)
      return true
    } catch (error) {
      if (error?.status === 409) await refreshReservation()
      onError(error)
      return false
    } finally {
      setActionKey(null)
    }
  }, [applyOfficialEffects, onError, onResult, onSuccess, refreshReservation, setActionKey, writesBlocked])

  const editReservation = useCallback((reservationId, payload) => execute({
    key: `reservation:edit:${reservationId}`,
    allowed: canCreateOrders && (!reservationMutationNeedsDiscount(payload) || canDiscountOrders),
    call: () => api.updateReservation(reservationId, payload),
    successMessage: messages.edit,
    action: 'edit',
  }), [api, canCreateOrders, canDiscountOrders, execute])

  const confirmArrival = useCallback((reservationId, expectedRevision, mutationId) => execute({
    key: `reservation:arrival:${reservationId}`,
    allowed: canCreateOrders,
    call: () => api.confirmArrival(reservationId, expectedRevision, mutationId),
    successMessage: messages.arrival,
    action: 'arrival',
  }), [api, canCreateOrders, execute])

  const cancelReservation = useCallback((reservationId, payload) => execute({
    key: `reservation:cancel:${reservationId}`,
    allowed: canCancelOrders,
    call: () => api.cancelReservation(reservationId, payload),
    successMessage: messages.cancel,
    action: 'cancel',
  }), [api, canCancelOrders, execute])

  const markNoShow = useCallback((reservationId, payload) => execute({
    key: `reservation:no-show:${reservationId}`,
    allowed: canCancelOrders,
    call: () => api.markNoShow(reservationId, payload),
    successMessage: messages.noShow,
    action: 'no-show',
  }), [api, canCancelOrders, execute])

  return {
    actionKey,
    pending: actionKey !== null,
    editReservation,
    confirmArrival,
    cancelReservation,
    markNoShow,
  }
}
