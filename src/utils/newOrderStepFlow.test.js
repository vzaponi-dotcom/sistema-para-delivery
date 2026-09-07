import test from 'node:test'
import assert from 'node:assert/strict'
import {
  NEW_ORDER_STEPS,
  canNavigateToNewOrderStep,
  createNewOrderDirtySnapshot,
  getFurthestReachedStep,
  getNewOrderStepAccess,
  getOrderItemCount,
  getOrderItemsSubtotal,
  isNewOrderDraftDirty,
  shouldConfirmNewOrderExit,
} from './newOrderStepFlow.js'

test('step access requires valid customer data before products and at least one item before review', () => {
  assert.deepEqual(
    getNewOrderStepAccess({ identityValid: false, orderDate: '2026-09-04', itemCount: 2 }),
    { customer: true, products: false, review: false },
  )
  assert.deepEqual(
    getNewOrderStepAccess({ identityValid: true, orderDate: '2026-09-04', itemCount: 0 }),
    { customer: true, products: true, review: false },
  )
  assert.deepEqual(
    getNewOrderStepAccess({ identityValid: true, orderDate: '2026-09-04', itemCount: 2 }),
    { customer: true, products: true, review: true },
  )
})

test('invalid schedule blocks products and schedule fields participate in dirty state', () => {
  assert.equal(getNewOrderStepAccess({ identityValid: true, orderDate: '2026-09-04', itemCount: 1, scheduleValid: false }).products, false)
  const initial = pristineDraft()
  const snapshot = createNewOrderDirtySnapshot(initial)
  assert.equal(isNewOrderDraftDirty({ ...initial, scheduleMode: 'scheduled', scheduledTime: '15:00' }, snapshot), true)
})

test('navigation allows the next step or an already reached step but never skips an unreached step', () => {
  const access = { customer: true, products: true, review: true }

  assert.equal(canNavigateToNewOrderStep({
    targetStep: NEW_ORDER_STEPS.PRODUCTS,
    currentStep: NEW_ORDER_STEPS.CUSTOMER,
    maxReachedStep: NEW_ORDER_STEPS.CUSTOMER,
    access,
  }), true)

  assert.equal(canNavigateToNewOrderStep({
    targetStep: NEW_ORDER_STEPS.REVIEW,
    currentStep: NEW_ORDER_STEPS.CUSTOMER,
    maxReachedStep: NEW_ORDER_STEPS.CUSTOMER,
    access,
  }), false)

  assert.equal(canNavigateToNewOrderStep({
    targetStep: NEW_ORDER_STEPS.REVIEW,
    currentStep: NEW_ORDER_STEPS.CUSTOMER,
    maxReachedStep: NEW_ORDER_STEPS.REVIEW,
    access,
  }), true)
})

test('furthest reached step only moves forward', () => {
  assert.equal(getFurthestReachedStep(NEW_ORDER_STEPS.CUSTOMER, NEW_ORDER_STEPS.PRODUCTS), NEW_ORDER_STEPS.PRODUCTS)
  assert.equal(getFurthestReachedStep(NEW_ORDER_STEPS.REVIEW, NEW_ORDER_STEPS.CUSTOMER), NEW_ORDER_STEPS.REVIEW)
})

test('product summary uses quantity and product subtotal only', () => {
  const items = [
    { productId: 1, quantity: 2, unitPrice: 20 },
    { productId: 2, quantity: 1, unitPrice: 15.5 },
  ]

  assert.equal(getOrderItemCount(items), 3)
  assert.equal(getOrderItemsSubtotal(items), 55.5)
})

const pristineDraft = () => ({
  clientId: 'client-1',
  type: 'Entrega',
  selectedTableId: '',
  localClientId: '',
  orderDate: '2026-09-04',
  items: [],
  deliveryFee: 'R$ 0,00',
  adjustment: { type: 'none', mode: 'fixed', value: 'R$ 0,00', reason: '' },
  quickClient: { open: false, name: '', phone: '' },
})

test('dirty state ignores opening an empty quick form but detects meaningful draft changes', () => {
  const initial = pristineDraft()
  const snapshot = createNewOrderDirtySnapshot(initial)

  assert.equal(isNewOrderDraftDirty(initial, snapshot), false)
  assert.equal(isNewOrderDraftDirty({ ...initial, quickClient: { open: true, name: '', phone: '' } }, snapshot), false)
  assert.equal(isNewOrderDraftDirty({ ...initial, clientId: 'client-2' }, snapshot), true)
  assert.equal(isNewOrderDraftDirty({ ...initial, items: [{ productId: 10, quantity: 1, note: '' }] }, snapshot), true)
  assert.equal(isNewOrderDraftDirty({ ...initial, deliveryFee: 'R$ 5,00' }, snapshot), true)
})

test('dirty state detects registered table and optional local client changes', () => {
  const initial = pristineDraft()
  const snapshot = createNewOrderDirtySnapshot(initial)

  assert.equal(isNewOrderDraftDirty({ ...initial, selectedTableId: 'table-4' }, snapshot), true)
  assert.equal(isNewOrderDraftDirty({ ...initial, localClientId: 'client-2' }, snapshot), true)
})

test('global exit confirmation only applies when leaving a dirty new order', () => {
  assert.equal(shouldConfirmNewOrderExit({ activeTab: 'new-order', targetTab: 'orders', draftDirty: true }), true)
  assert.equal(shouldConfirmNewOrderExit({ activeTab: 'new-order', targetTab: 'new-order', draftDirty: true }), false)
  assert.equal(shouldConfirmNewOrderExit({ activeTab: 'new-order', targetTab: 'orders', draftDirty: false }), false)
  assert.equal(shouldConfirmNewOrderExit({ activeTab: 'orders', targetTab: 'clients', draftDirty: true }), false)
})
