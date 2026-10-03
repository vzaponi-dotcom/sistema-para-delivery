import { useMutationOwner } from '../../runtime/session/useMutationOwner.js'
import { useCallback, useRef, useState } from 'react'
import { refundApi } from './refundApi.js'

export function useRefundWorkflow({
  api = refundApi,
  canRefundPayments = false,
  writesBlocked = false,
  applyOfficialEffects = () => {},
  setRequestKey = () => {},
  onSuccess = () => {},
  onError = () => {},
} = {}) {
  const ownsMutation = useMutationOwner(applyOfficialEffects)
  const targetRef = useRef(null)
  const submittingRef = useRef(false)
  const [refundOrder, setRefundOrder] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const request = useCallback((order) => {
    if (!canRefundPayments || writesBlocked || !order || submittingRef.current || targetRef.current) return false
    targetRef.current = order
    setRefundOrder(order)
    return true
  }, [canRefundPayments, writesBlocked])

  const close = useCallback(() => {
    if (submittingRef.current) return false
    targetRef.current = null
    setRefundOrder(null)
    return true
  }, [])

  const confirm = useCallback(async (payload) => {
    const target = targetRef.current
    if (!target || submittingRef.current || !canRefundPayments || writesBlocked) return false
    const requestKey = `order:refund:${target.id}`
    submittingRef.current = true
    setSubmitting(true)
    setRequestKey(requestKey)
    try {
      const { order, movement } = await api.refundOrder(target.id, payload)
      if (!ownsMutation()) return false

      if (applyOfficialEffects({ order, movement }) === false) return false
      onSuccess('Estorno registrado com sucesso')
      targetRef.current = null
      setRefundOrder(null)
      return true
    } catch (error) {
      if (!ownsMutation()) return false
      onError(error)
      return false
    } finally {
      if (ownsMutation()) {
        submittingRef.current = false
        setSubmitting(false)
        setRequestKey((current) => current === requestKey ? null : current)
      }
    }
  }, [ownsMutation, api, applyOfficialEffects, canRefundPayments, onError, onSuccess, setRequestKey, writesBlocked])

  const reset = useCallback(() => { targetRef.current = null; submittingRef.current = false; setRefundOrder(null); setSubmitting(false) }, [])
  return { request, close, reset, refundOrder, submitting, confirm }
}
