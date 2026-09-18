import test from 'node:test'
import assert from 'node:assert/strict'
import { getOrderRefundState, isOrderActive, isOrderCancelled, isOrderFinished } from './orderLifecycle.js'

test('order lifecycle helpers centralize cancelled and terminal semantics', () => {
  const active = { status: 'Em preparo', paymentStatus: 'Pendente' }
  const finished = { status: 'Finalizado', paymentStatus: 'Pago' }
  const cancelledUnpaid = { status: 'Cancelado', paymentStatus: 'Pendente' }
  const cancelledPaidPendingRefund = { status: 'Cancelado', paymentStatus: 'Pago', refundState: 'pending' }
  const cancelledRefunded = { status: 'Cancelado', paymentStatus: 'Pago', refundState: 'refunded' }

  assert.equal(isOrderCancelled(active), false)
  assert.equal(isOrderCancelled(cancelledUnpaid), true)

  assert.equal(isOrderFinished(active), false)
  assert.equal(isOrderFinished(finished), true)
  assert.equal(isOrderFinished(cancelledUnpaid), true)

  assert.equal(isOrderActive(active), true)
  assert.equal(isOrderActive(finished), false)
  assert.equal(isOrderActive(cancelledUnpaid), false)

  assert.equal(getOrderRefundState(active), 'none')
  assert.equal(getOrderRefundState(cancelledUnpaid), 'none')
  assert.equal(getOrderRefundState(cancelledPaidPendingRefund), 'pending')
  assert.equal(getOrderRefundState(cancelledRefunded), 'refunded')
})
