import assert from 'node:assert/strict'
import test from 'node:test'
import { createNewOrderDraftController, createReservationEditDraftContext } from './newOrderDraft.js'

test('draft owns generation, idempotency, dirtiness, and stale invalidation', () => {
  const ids = ['key-1', 'key-2']
  const controller = createNewOrderDraftController({ randomUUID: () => ids.shift() })
  assert.deepEqual(controller.snapshot(), { context: null, dirty: false, renderKey: null })
  controller.open({ returnDestination: 'orders' })
  controller.setDirty(true)
  const first = controller.beginSubmit()
  assert.equal(first.idempotencyKey, 'key-1')
  assert.equal(controller.isCurrent(first), true)
  controller.open({ returnDestination: 'comandas', tableId: 't-1', expectedTableTabId: 'tab-1' })
  assert.equal(controller.isCurrent(first), false)
  assert.equal(controller.snapshot().dirty, false)
  assert.equal(controller.beginSubmit().idempotencyKey, 'key-2')
})

test('complete clears only the current draft', () => {
  const controller = createNewOrderDraftController({ randomUUID: () => 'key' })
  controller.open({ returnDestination: 'orders' })
  const token = controller.beginSubmit()
  assert.equal(controller.complete(token), true)
  assert.equal(controller.isCurrent(token), false)
  assert.equal(controller.snapshot().context, null)
})


test('edit-reservation context is explicit and derives the current official snapshot for the shared wizard', () => {
  const detail = {
    reservation: {
      id: 'reservation-1',
      orderId: 'order-1',
      tableId: 'table-3',
      tableName: 'Mesa 3',
      status: 'reserved',
      scheduledFor: '2026-10-10T23:30:00.000Z',
      revision: 7,
    },
    order: {
      id: 'order-1',
      orderNumber: 81,
      clientId: 'client-2',
      type: 'Local',
      orderDate: '2026-10-10',
      scheduledFor: '2026-10-10T23:30:00.000Z',
      deliveryFee: 0,
      adjustment: { type: 'discount', mode: 'fixed', value: 5, reason: 'Cortesia' },
      items: [
        { productId: 'p1', name: 'Marmita', category: 'Refeições', size: 'G', unitPrice: 32, quantity: 2, note: 'sem cebola' },
      ],
    },
    hasManualPrintHistory: true,
  }

  assert.deepEqual(createReservationEditDraftContext(detail, { returnDestination: 'comandas' }), {
    mode: 'edit-reservation',
    returnDestination: 'comandas',
    tableId: 'table-3',
    expectedTableTabId: '',
    reservationContext: {
      id: 'reservation-1',
      orderId: 'order-1',
      orderNumber: 81,
      expectedRevision: 7,
      hasManualPrintHistory: true,
    },
    initialDraft: {
      clientId: 'client-2',
      type: 'Local',
      selectedTableId: 'table-3',
      localClientId: 'client-2',
      orderDate: '2026-10-10',
      scheduleMode: 'scheduled',
      scheduledTime: '20:30',
      items: [
        { lineId: 'reservation:item:0', productId: 'p1', name: 'Marmita', category: 'Refeições', size: 'G', unitPrice: 32, quantity: 2, note: 'sem cebola' },
      ],
      deliveryFee: 0,
      adjustment: { type: 'discount', mode: 'fixed', value: 5, reason: 'Cortesia' },
    },
  })
})

test('draft controller preserves mode and reservation context through submit token and discard never mutates reservation lifecycle', () => {
  const controller = createNewOrderDraftController({ randomUUID: () => 'create-key' })
  const context = createReservationEditDraftContext({
    reservation: {
      id: 'reservation-2',
      orderId: 'order-2',
      tableId: 'table-4',
      status: 'reserved',
      scheduledFor: '2026-10-11T22:00:00.000Z',
      revision: 3,
    },
    order: {
      id: 'order-2',
      orderNumber: 82,
      clientId: null,
      type: 'Local',
      orderDate: '2026-10-11',
      scheduledFor: '2026-10-11T22:00:00.000Z',
      items: [],
      adjustment: { type: 'none', mode: 'fixed', value: 0, reason: '' },
    },
  })

  const opened = controller.open(context)
  assert.equal(opened.context.mode, 'edit-reservation')
  assert.equal(opened.context.reservationContext.expectedRevision, 3)
  const token = controller.beginSubmit()
  assert.equal(token.context.mode, 'edit-reservation')
  assert.equal(token.context.reservationContext.id, 'reservation-2')
  assert.equal(token.idempotencyKey, null)

  const discarded = controller.discard()
  assert.equal(discarded.context, null)
  assert.equal(controller.isCurrent(token), false)
})
