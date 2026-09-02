import {
  moneyToCents,
  optionalTextMax,
  requireNonEmpty,
  validateIsoDate,
  validateOrderType,
  validatePaymentMethod,
  validatePositiveInteger,
} from './validation.js'

const checkoutError = (field, message) => Object.assign(new Error(message), {
  status: 400,
  code: 'VALIDATION_ERROR',
  field,
})

const normalizeSpaces = (value) => value.replace(/\s+/g, ' ')

const percentageToBasisPoints = (value) => {
  const raw = typeof value === 'number' ? String(value) : String(value ?? '').trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    throw checkoutError('adjustment.value', 'Informe um percentual entre 0,00 e 100,00 com até duas casas decimais.')
  }
  const number = Number(raw)
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw checkoutError('adjustment.value', 'Informe um percentual entre 0,00 e 100,00 com até duas casas decimais.')
  }
  return Math.round(number * 100)
}

const validateAdjustment = (value = {}) => {
  const type = value?.type ?? 'none'
  if (!['none', 'discount', 'surcharge'].includes(type)) {
    throw checkoutError('adjustment.type', 'Tipo de ajuste inválido.')
  }

  const mode = value?.mode ?? 'fixed'
  if (!['fixed', 'percentage'].includes(mode)) {
    throw checkoutError('adjustment.mode', 'Modo de ajuste inválido.')
  }

  const reason = optionalTextMax(value?.reason, 200, 'adjustment.reason')
  if (type === 'none') return { type: 'none', mode: 'fixed', storedValue: 0, reason }

  const storedValue = mode === 'percentage'
    ? percentageToBasisPoints(value?.value ?? 0)
    : moneyToCents(value?.value ?? 0, 'adjustment.value')

  return { type, mode, storedValue, reason }
}

export const validateCheckoutInput = (body = {}, idempotencyKey) => {
  const clientId = requireNonEmpty(body.clientId, 'clientId')
  const type = validateOrderType(body.type)
  const orderDate = validateIsoDate(body.orderDate, 'orderDate')
  const stableKey = requireNonEmpty(idempotencyKey, 'idempotency-key')

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw checkoutError('items', 'Adicione pelo menos um item ao pedido.')
  }

  const items = body.items.map((item, index) => ({
    productId: requireNonEmpty(item?.productId, `items.${index}.productId`),
    quantity: validatePositiveInteger(item?.quantity, `items.${index}.quantity`),
    note: normalizeSpaces(optionalTextMax(item?.note, 300, `items.${index}.note`)),
  }))

  const deliveryFeeCents = moneyToCents(body.deliveryFee ?? 0, 'deliveryFee')
  if (type !== 'Entrega' && deliveryFeeCents !== 0) {
    throw checkoutError('deliveryFee', 'Taxa de entrega só pode ser usada em pedidos de entrega.')
  }

  const adjustment = validateAdjustment(body.adjustment)
  const paymentMethod = body.paymentMethod === undefined || body.paymentMethod === null || body.paymentMethod === ''
    ? null
    : validatePaymentMethod(body.paymentMethod)

  return {
    clientId,
    type,
    orderDate,
    items,
    deliveryFeeCents: type === 'Entrega' ? deliveryFeeCents : 0,
    adjustment,
    paymentMethod,
    idempotencyKey: stableKey,
  }
}

export const calculateCheckoutTotals = (pricedItems, deliveryFeeCents = 0, adjustment = {}) => {
  const subtotalCents = (Array.isArray(pricedItems) ? pricedItems : []).reduce((sum, item) => {
    const quantity = validatePositiveInteger(item?.quantity, 'quantity')
    const priceCents = Number(item?.priceCents)
    if (!Number.isInteger(priceCents) || priceCents < 0) throw checkoutError('price', 'Preço de produto inválido.')
    return sum + (priceCents * quantity)
  }, 0)

  const feeCents = Number(deliveryFeeCents)
  if (!Number.isInteger(feeCents) || feeCents < 0) throw checkoutError('deliveryFee', 'Taxa de entrega inválida.')

  const type = ['discount', 'surcharge'].includes(adjustment?.type) ? adjustment.type : 'none'
  const mode = adjustment?.mode === 'percentage' ? 'percentage' : 'fixed'
  const storedValue = Number(adjustment?.storedValue) || 0
  if (!Number.isInteger(storedValue) || storedValue < 0) throw checkoutError('adjustment.value', 'Valor de ajuste inválido.')

  let adjustmentAmountCents = 0
  if (type !== 'none') {
    adjustmentAmountCents = mode === 'percentage'
      ? Math.round(subtotalCents * storedValue / 10000)
      : storedValue
    if (type === 'discount') adjustmentAmountCents = Math.min(subtotalCents, adjustmentAmountCents)
  }

  const adjustedProductsCents = type === 'discount'
    ? subtotalCents - adjustmentAmountCents
    : subtotalCents + (type === 'surcharge' ? adjustmentAmountCents : 0)

  return {
    subtotalCents,
    adjustmentAmountCents,
    totalCents: adjustedProductsCents + feeCents,
  }
}
