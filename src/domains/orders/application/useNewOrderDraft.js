import { useCallback, useRef, useState } from 'react'
import { createNewOrderDraftController } from './newOrderDraft.js'

export function useNewOrderDraft({
  submitOrder,
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
  const canSubmitRef = useRef(canSubmit)
  const commitOfficialEffectsRef = useRef(commitOfficialEffects)
  const onCommittedRef = useRef(onCommitted)
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  const onConflictRef = useRef(onConflict)

  submitOrderRef.current = submitOrder
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
    if (!token || pendingRef.current || !canSubmitRef.current(payload)) return false
    pendingRef.current = true
    setCheckoutPending(true)
    try {
      const result = await submitOrderRef.current(payload, token.idempotencyKey)
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
      if (error?.status === 409 && token.context.expectedTableTabId) await onConflictRef.current(token.context)
      if (controllerRef.current.isCurrent(token)) onErrorRef.current(error)
      return false
    } finally {
      if (controllerRef.current.isCurrent(token)) {
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
    discard,
    setDirty,
    submit,
    reset,
  }
}
