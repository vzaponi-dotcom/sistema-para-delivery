import { useCallback, useRef, useState } from 'react'
import {
  paymentOptionsWithSelection,
  paymentSelectionNeedsReview,
} from '../../../../domains/finance/index.js'
import {
  canReceiveStandaloneOrder,
  isOrderCancelled,
} from '../../../../domains/orders/index.js'
import { paymentApi } from '../paymentApi.js'

const operationalSources = new Set(['orders', 'history'])

export function useOrderPaymentWorkflow({
  api = paymentApi,
  orders = [],
  granted = new Set(),
  canReceivePayments = false,
  writesBlocked = false,
  paymentOptions = [],
  defaultPaymentMethod = '',
  getSyncGuard = () => null,
  applyOfficialEffects = () => {},
  refreshOfficialData = async () => false,
  setRequestKey = () => {},
  onSuccess = () => {},
  onError = () => {},
} = {}) {
  const sequenceRef = useRef(0)
  const dialogOwnerRef = useRef(null)
  const [dialogOwner, setDialogOwner] = useState(null)
  const [method, setMethod] = useState('')
  const [, forceRender] = useState(0)

  const getOrder = useCallback(
    (orderId) => orders.find((order) => order.id === orderId) ?? null,
    [orders],
  )

  const isEligible = useCallback((order, source) => {
    if (!order || !canReceivePayments) return false
    if (operationalSources.has(source)) return canReceiveStandaloneOrder(order, granted, source)
    return order.paymentStatus !== 'Pago' && !isOrderCancelled(order)
  }, [canReceivePayments, granted])

  const clearRequestKey = useCallback((owner) => {
    if (!owner?.requestKey) return
    setRequestKey((current) => current === owner.requestKey ? null : current)
  }, [setRequestKey])

  const close = useCallback((expectedOwner = dialogOwnerRef.current) => {
    if (expectedOwner && dialogOwnerRef.current !== expectedOwner) return false
    const owner = dialogOwnerRef.current
    dialogOwnerRef.current = null
    setDialogOwner(null)
    setMethod('')
    clearRequestKey(owner)
    return true
  }, [clearRequestKey])

  const open = useCallback((orderId, source) => {
    if (writesBlocked || !canReceivePayments) return false
    const order = getOrder(orderId)
    const operational = operationalSources.has(source)
    if (!isEligible(order, operational ? source : null)) return false
    const owner = {
      token: ++sequenceRef.current,
      guard: getSyncGuard(),
      orderId,
      source: operational ? source : null,
      submitting: false,
      requestKey: null,
      method: null,
    }
    dialogOwnerRef.current = owner
    setDialogOwner(owner)
    setMethod(defaultPaymentMethod)
    return true
  }, [canReceivePayments, defaultPaymentMethod, getOrder, getSyncGuard, isEligible, writesBlocked])

  const submit = useCallback(async () => {
    const owner = dialogOwnerRef.current
    const currentOrder = owner ? getOrder(owner.orderId) : null
    if (
      !owner
      || owner.guard !== getSyncGuard()
      || owner.submitting
      || writesBlocked
      || !isEligible(currentOrder, owner.source)
      || !method
      || paymentSelectionNeedsReview(paymentOptions, method)
    ) return false

    owner.submitting = true
    owner.method = method
    owner.requestKey = `payment:${owner.orderId}:${owner.token}`
    setRequestKey(owner.requestKey)
    forceRender((value) => value + 1)

    try {
      const { order, movement, tableTab } = await api.registerOrderPayment(owner.orderId, owner.method)
      if (owner.guard !== getSyncGuard()) return false

      applyOfficialEffects({ order, movement, tableTab })

      if (dialogOwnerRef.current === owner) {
        close(owner)
        onSuccess(`Pagamento recebido via ${owner.method}`)
      }
      return true
    } catch (error) {
      if (owner.guard !== getSyncGuard()) return false
      if (error?.status === 409 || !Number.isInteger(error?.status) || error.status >= 500) {
        await refreshOfficialData()
      }
      if (owner.guard !== getSyncGuard()) return false
      if (dialogOwnerRef.current === owner) onError(error)
      return false
    } finally {
      owner.submitting = false
      clearRequestKey(owner)
      if (dialogOwnerRef.current === owner) forceRender((value) => value + 1)
    }
  }, [
    api,
    applyOfficialEffects,
    clearRequestKey,
    close,
    getOrder,
    getSyncGuard,
    isEligible,
    method,
    onError,
    onSuccess,
    paymentOptions,
    refreshOfficialData,
    setRequestKey,
    writesBlocked,
  ])

  const order = dialogOwner ? getOrder(dialogOwner.orderId) : null
  const eligible = dialogOwner ? isEligible(order, dialogOwner.source) : false
  const needsReview = paymentSelectionNeedsReview(paymentOptions, method)
  const visibleOptions = paymentOptionsWithSelection(paymentOptions, method)

  const dialog = dialogOwner && eligible ? {
    order,
    method,
    setMethod,
    visibleOptions,
    needsReview,
    submitting: Boolean(dialogOwner.submitting),
    writesBlocked,
    onClose: () => close(dialogOwner),
    submit,
  } : null

  return { open, close, dialog }
}
