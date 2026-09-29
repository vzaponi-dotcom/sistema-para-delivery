import { useCallback, useRef, useState } from 'react'
import {
  createNewOrderDraftController,
  createReservationEditDraftContext,
} from './newOrderDraft.js'

export function useNewOrderDraft({
  submitOrder,
  submitReservationEdit,
  refreshReservation,
  canSubmit,
  commitOfficialEffects,
  onCommitted,
  onSuccess,
  onError,
  onConflict,
}) {
  const controllerRef = useRef(null)
  if (!controllerRef.current) controllerRef.current = createNewOrderDraftController()

  const [draft, setDraft] = useState(() => controllerRef.current.snapshot())
  const [checkoutPending, setCheckoutPending] = useState(false)
  const pendingRef = useRef(false)
  const submitOrderRef = useRef(submitOrder)
  const submitReservationEditRef = useRef(submitReservationEdit)
  const refreshReservationRef = useRef(refreshReservation)
  const canSubmitRef = useRef(canSubmit)
  const commitOfficialEffectsRef = useRef(commitOfficialEffects)
  const onCommittedRef = useRef(onCommitted)
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  const onConflictRef = useRef(onConflict)

  submitOrderRef.current = submitOrder
  submitReservationEditRef.current = submitReservationEdit
  refreshReservationRef.current = refreshReservation
  canSubmitRef.current = canSubmit
  commitOfficialEffectsRef.current = commitOfficialEffects
  onCommittedRef.current = onCommitted
  onSuccessRef.current = onSuccess
  onErrorRef.current = onError
  onConflictRef.current = onConflict

  const publish = useCallback(() => {
    const next = controllerRef.current.snapshot()
    setDraft(next)
    return next
  }, [])

  const clearPending = useCallback(() => {
    pendingRef.current = false
    setCheckoutPending(false)
  }, [])

  const open = useCallback((context) => {
    clearPending()
    const next = controllerRef.current.open(context)
    setDraft(next)
    return next
  }, [clearPending])

  const openReservationEdit = useCallback((detail, options) => {
    const context = createReservationEditDraftContext(detail, options)
    if (!context) return null
    return open(context)
  }, [open])

  const discard = useCallback(() => {
    clearPending()
    const next = controllerRef.current.discard()
    setDraft(next)
    return next
  }, [clearPending])

  const setDirty = useCallback((value) => {
    const next = controllerRef.current.setDirty(value)
    setDraft(next)
    return next
  }, [])

  const reset = useCallback(() => {
    clearPending()
    const next = controllerRef.current.discard()
    setDraft(next)
    return next
  }, [clearPending])

  const submit = useCallback(async (payload) => {
    const token = controllerRef.current.beginSubmit()
    if (!token || pendingRef.current || !canSubmitRef.current(payload, token.context)) return false

    const editMode = token.context.mode === 'edit-reservation'
    const reservationContext = token.context.reservationContext
    if (editMode && (!reservationContext?.id || !submitReservationEditRef.current)) return false
    if (!editMode && !submitOrderRef.current) return false

    pendingRef.current = true
    setCheckoutPending(true)
    try {
      const result = editMode
        ? await submitReservationEditRef.current(
            reservationContext.id,
            { ...payload, expectedRevision: reservationContext.expectedRevision },
          )
        : await submitOrderRef.current(payload, token.idempotencyKey)

      if (!controllerRef.current.isCurrent(token)) return false
      commitOfficialEffectsRef.current(result)
      await onCommittedRef.current(result, token.context)
      onSuccessRef.current(result.order, token.context)
      pendingRef.current = false
      setCheckoutPending(false)
      controllerRef.current.complete(token)
      publish()
      return true
    } catch (error) {
      if (!controllerRef.current.isCurrent(token)) return false

      if (error?.code === 'POLICY_CHANGED') {
        onErrorRef.current(error)
        return { ok: false, code: 'POLICY_CHANGED' }
      }

      if (error?.status === 409) {
        if (editMode && refreshReservationRef.current) {
          const refreshed = await refreshReservationRef.current(reservationContext.id)
          if (controllerRef.current.isCurrent(token) && refreshed) {
            const nextContext = createReservationEditDraftContext(refreshed, {
              returnDestination: token.context.returnDestination,
            })
            if (nextContext) {
              controllerRef.current.replaceCurrent(token, nextContext)
              publish()
            }
          }
          await onConflictRef.current?.(token.context, error)
        } else if (token.context.expectedTableTabId) {
          await onConflictRef.current?.(token.context, error)
        }
      }

      if (controllerRef.current.isCurrent(token) || editMode) onErrorRef.current(error)
      return false
    } finally {
      if (controllerRef.current.isCurrent(token)) {
        pendingRef.current = false
        setCheckoutPending(false)
      } else if (editMode) {
        pendingRef.current = false
        setCheckoutPending(false)
      }
    }
  }, [publish])

  return {
    context: draft.context,
    renderKey: draft.renderKey,
    dirty: draft.dirty,
    checkoutPending,
    open,
    openReservationEdit,
    discard,
    setDirty,
    submit,
    reset,
  }
}
