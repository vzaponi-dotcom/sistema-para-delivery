export const NEW_ORDER_STEPS = Object.freeze({
  CUSTOMER: 'customer',
  PRODUCTS: 'products',
  REVIEW: 'review',
})

export const NEW_ORDER_STEP_ORDER = Object.freeze([
  NEW_ORDER_STEPS.CUSTOMER,
  NEW_ORDER_STEPS.PRODUCTS,
  NEW_ORDER_STEPS.REVIEW,
])

const stepIndex = (step) => NEW_ORDER_STEP_ORDER.indexOf(step)

export const getOrderItemCount = (items = []) => items.reduce(
  (sum, item) => sum + Number(item.quantity || 0),
  0,
)

export const getOrderItemsSubtotal = (items = []) => items.reduce(
  (sum, item) => sum + (Number(item.unitPrice || 0) * Number(item.quantity || 0)),
  0,
)

export const getNewOrderStepAccess = ({ identityValid, orderDate, itemCount, scheduleValid = true }) => {
  const customerReady = Boolean(identityValid && orderDate)
  return {
    customer: true,
    products: Boolean(customerReady && scheduleValid),
    review: Boolean(customerReady && scheduleValid && Number(itemCount || 0) > 0),
  }
}

export const canNavigateToNewOrderStep = ({ targetStep, currentStep, maxReachedStep, access }) => {
  if (!access?.[targetStep]) return false
  const targetIndex = stepIndex(targetStep)
  const currentIndex = stepIndex(currentStep)
  const maxReachedIndex = stepIndex(maxReachedStep)
  if (targetIndex < 0 || currentIndex < 0 || maxReachedIndex < 0) return false
  return targetIndex <= maxReachedIndex || targetIndex === currentIndex + 1
}

export const getFurthestReachedStep = (currentMaxStep, nextStep) => (
  stepIndex(nextStep) > stepIndex(currentMaxStep) ? nextStep : currentMaxStep
)

const normalizeText = (value) => String(value ?? '').trim()

export const createNewOrderDirtySnapshot = (draft = {}) => JSON.stringify({
  clientId: String(draft.clientId ?? ''),
  type: String(draft.type ?? ''),
  selectedTableId: String(draft.selectedTableId ?? ''),
  localClientId: String(draft.localClientId ?? ''),
  orderDate: String(draft.orderDate ?? ''),
  scheduleMode: String(draft.scheduleMode ?? 'now'),
  scheduledTime: String(draft.scheduledTime ?? ''),
  items: (draft.items ?? []).map((item) => ({
    productId: item.productId,
    quantity: Number(item.quantity || 0),
    note: normalizeText(item.note),
  })),
  deliveryFee: String(draft.deliveryFee ?? ''),
  adjustment: {
    type: String(draft.adjustment?.type ?? 'none'),
    mode: String(draft.adjustment?.mode ?? 'fixed'),
    value: String(draft.adjustment?.value ?? ''),
    reason: normalizeText(draft.adjustment?.reason),
  },
  quickClient: {
    name: normalizeText(draft.quickClient?.name),
    phone: normalizeText(draft.quickClient?.phone),
  },
})

export const isNewOrderDraftDirty = (draft, initialSnapshot) => (
  createNewOrderDirtySnapshot(draft) !== initialSnapshot
)

export const shouldConfirmNewOrderExit = ({ activeTab, targetTab, draftDirty }) => (
  activeTab === 'new-order' && targetTab !== 'new-order' && Boolean(draftDirty)
)
