import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canReceiveStandaloneOrder,
  getOrderItemsSearchText,
  getOrderRefundState,
  isOrderCancelled,
  toLocalDateValue,
} from './index.js'

test('orders public contract exposes existing pure rules', () => {
  const active = { id: 'o-1', status: 'Em preparo', items: [{ name: 'Marmita P' }] }
  const cancelled = { id: 'o-2', status: 'Cancelado', paymentStatus: 'Pago' }
  assert.equal(isOrderCancelled(cancelled), true)
  assert.equal(getOrderRefundState(cancelled), 'pending')
  assert.match(getOrderItemsSearchText(active), /marmita/i)
  assert.equal(typeof toLocalDateValue(new Date('2026-09-17T12:00:00-03:00')), 'string')
  assert.equal(typeof canReceiveStandaloneOrder, 'function')
})
