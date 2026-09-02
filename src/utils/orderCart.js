const cleanSpaces = (value) => String(value ?? '').trim().replace(/\s+/g, ' ')
const toNonNegativeNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}
const moneyToCents = (value) => Math.round((toNonNegativeNumber(value) + Number.EPSILON) * 100)
const centsToMoney = (value) => Number(value || 0) / 100

export const normalizeItemNote = (value) => cleanSpaces(value).slice(0, 300)
const mergeKey = (productId, note) => `${productId}::${normalizeItemNote(note).toLocaleLowerCase('pt-BR')}`

export const addCartItem = (items, product, note = '') => {
  const normalizedNote = normalizeItemNote(note)
  const key = mergeKey(product.id, normalizedNote)
  const existing = items.find((item) => mergeKey(item.productId, item.note) === key)

  if (existing) {
    return items.map((item) => item.lineId === existing.lineId
      ? { ...item, quantity: Math.max(1, Number(item.quantity) || 1) + 1 }
      : item)
  }

  return [...items, {
    lineId: crypto.randomUUID(),
    productId: product.id,
    name: product.name,
    category: product.category || '',
    size: product.size || '',
    unitPrice: toNonNegativeNumber(product.price),
    quantity: 1,
    note: normalizedNote,
  }]
}

export const updateCartItem = (items, lineId, patch = {}) => {
  const current = items.find((item) => item.lineId === lineId)
  if (!current) return items

  const updated = {
    ...current,
    ...patch,
    quantity: patch.quantity === undefined
      ? Math.max(1, Number(current.quantity) || 1)
      : Math.max(1, Math.trunc(Number(patch.quantity) || 1)),
    note: patch.note === undefined ? normalizeItemNote(current.note) : normalizeItemNote(patch.note),
  }

  const withoutCurrent = items.filter((item) => item.lineId !== lineId)
  const equivalent = withoutCurrent.find((item) => mergeKey(item.productId, item.note) === mergeKey(updated.productId, updated.note))

  if (!equivalent) {
    return items.map((item) => item.lineId === lineId ? updated : item)
  }

  return withoutCurrent.map((item) => item.lineId === equivalent.lineId
    ? { ...item, quantity: Math.max(1, Number(item.quantity) || 1) + updated.quantity }
    : item)
}

export const removeCartItem = (items, lineId) => items.filter((item) => item.lineId !== lineId)

export const calculateOrderPreview = (draft = {}) => {
  const subtotalCents = (Array.isArray(draft.items) ? draft.items : []).reduce(
    (sum, item) => sum + moneyToCents(item.unitPrice) * Math.max(1, Math.trunc(Number(item.quantity) || 1)),
    0,
  )
  const deliveryFeeCents = draft.type === 'Entrega' ? moneyToCents(draft.deliveryFee) : 0
  const adjustment = draft.adjustment || {}
  const type = ['discount', 'surcharge'].includes(adjustment.type) ? adjustment.type : 'none'
  const mode = adjustment.mode === 'percentage' ? 'percentage' : 'fixed'
  const value = toNonNegativeNumber(adjustment.value)

  let adjustmentAmountCents = 0
  if (type !== 'none') {
    adjustmentAmountCents = mode === 'percentage'
      ? Math.round(subtotalCents * Math.min(100, value) / 100)
      : moneyToCents(value)
    if (type === 'discount') adjustmentAmountCents = Math.min(subtotalCents, adjustmentAmountCents)
  }

  const adjustedProductsCents = type === 'discount'
    ? subtotalCents - adjustmentAmountCents
    : subtotalCents + (type === 'surcharge' ? adjustmentAmountCents : 0)

  return {
    subtotal: centsToMoney(subtotalCents),
    deliveryFee: centsToMoney(deliveryFeeCents),
    adjustmentAmount: centsToMoney(adjustmentAmountCents),
    total: centsToMoney(adjustedProductsCents + deliveryFeeCents),
  }
}

export const buildOrderPayload = (draft = {}, paymentMethod) => {
  const adjustment = draft.adjustment || {}
  const payload = {
    clientId: draft.clientId,
    type: draft.type,
    orderDate: draft.orderDate,
    items: (Array.isArray(draft.items) ? draft.items : []).map((item) => ({
      productId: item.productId,
      quantity: Math.max(1, Math.trunc(Number(item.quantity) || 1)),
      note: normalizeItemNote(item.note),
    })),
    deliveryFee: draft.type === 'Entrega' ? toNonNegativeNumber(draft.deliveryFee) : 0,
    adjustment: {
      type: ['discount', 'surcharge'].includes(adjustment.type) ? adjustment.type : 'none',
      mode: adjustment.mode === 'percentage' ? 'percentage' : 'fixed',
      value: toNonNegativeNumber(adjustment.value),
      reason: cleanSpaces(adjustment.reason).slice(0, 200),
    },
  }
  if (paymentMethod) payload.paymentMethod = paymentMethod
  return payload
}

export const getOrderItems = (order = {}) => {
  if (Array.isArray(order.items) && order.items.length) return order.items

  const quantity = Math.max(1, Math.trunc(Number(order.quantity) || 1))
  const total = toNonNegativeNumber(order.total)
  const inferredUnitPrice = quantity ? total / quantity : total
  const name = order.productName || (order.size ? `Marmita ${order.size}` : 'Produto')

  return [{
    id: `legacy-${order.id ?? 'order'}`,
    lineId: `legacy-${order.id ?? 'order'}`,
    productId: order.productId ?? null,
    name,
    category: order.category || '',
    size: order.size || '',
    quantity,
    catalogPrice: inferredUnitPrice,
    unitPrice: inferredUnitPrice,
    note: '',
  }]
}

export const getOrderItemsSummary = (order) => getOrderItems(order)
  .map((item) => `${Math.max(1, Number(item.quantity) || 1)}× ${item.name}`)
  .join(' · ')

export const getOrderItemsSearchText = (order) => getOrderItems(order)
  .map((item) => [item.name, item.category, item.size, item.note].filter(Boolean).join(' '))
  .join(' ')
