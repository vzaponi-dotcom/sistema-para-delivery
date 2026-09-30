import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { useOrderCommands } from '../../../domains/orders/application/useOrderCommands.js'
import { useCustomerCommands } from '../../../domains/customers/application/useCustomerCommands.js'
import { useCatalogCommands } from '../../../domains/catalog/application/useCatalogCommands.js'
import { useFinanceCommands } from '../../../domains/finance/application/useFinanceCommands.js'
import { useTableServiceCommands } from '../../../domains/table-service/application/useTableServiceCommands.js'
import { useTableReservationCommands } from '../../../domains/table-service/application/useTableReservationCommands.js'
import { useRefundWorkflow } from '../../workflows/refunds/useRefundWorkflow.js'
import { useOrderPaymentPromise } from '../../../domains/orders/application/useOrderPaymentPromise.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
for (const [name, hook, command, method, response, options] of [
  ['order', useOrderCommands, 'finalizeOrder', 'updateOrderStatus', { order: { id: 'o' } }, { orders: [{ id: 'o' }], canFinalizeOrders: true }],
  ['customer', useCustomerCommands, 'createClient', 'createClient', { client: { id: 'c' } }, { canCreateClients: true, canUpdateClients: true, canDeleteClients: true }],
  ['catalog', useCatalogCommands, 'createProduct', 'createProduct', { product: { id: 'p' } }, { canManageProducts: true }],
  ['finance', useFinanceCommands, 'saveMovement', 'createMovement', { movement: { id: 'm' } }, { canManageMovements: true }],
  ['table', useTableServiceCommands, 'createTable', 'createTable', { tables: [] }, { canManageTables: true }],
  ['reservation', useTableReservationCommands, 'confirmArrival', 'confirmArrival', { order: { id: 'o' } }, { canCreateOrders: true }],
  ['payment promise', useOrderPaymentPromise, 'updatePaymentPromise', 'updatePaymentPromise', { order: { id: 'o' } }, { canManagePaymentPromises: true }],
]) test(`${name} old response cannot publish success or clear the new session request`, async (t) => {
  let resolve, current
  const activity = []
  const api = { [method]: () => new Promise((done) => { resolve = done }) }
  const Harness = ({ effects }) => { current = hook({ ...options, api, applyOfficialEffects: effects, onSuccess: () => activity.push('success'), onError: () => activity.push('error'), setRequestKey: (key) => activity.push(key) }); return null }
  let renderer
  await act(async () => { renderer = create(React.createElement(Harness, { effects: () => activity.push('old effect') })) })
  t.after(() => renderer.unmount())
  let pending
  await act(async () => { pending = current[command]('o') })
  await act(async () => renderer.update(React.createElement(Harness, { effects: () => activity.push('new effect') })))
  activity.length = 0
  await act(async () => { resolve(response); await pending })
  assert.deepEqual(activity, [])
})

test('old mutation authentication errors do not reach the new session handlers', async (t) => {
  for (const error of [{ status: 401 }, { status: 403, code: 'ACCESS_CHANGED' }]) {
    let reject, current
    const errors = []
    const api = { updateOrderStatus: () => new Promise((resolve, fail) => { reject = fail }) }
    const Harness = ({ effects }) => { current = useOrderCommands({ orders: [{ id: 'o' }], api, applyOfficialEffects: effects, canFinalizeOrders: true, onSuccess() {}, onError: (value) => errors.push(value) }); return null }
    let renderer
    await act(async () => { renderer = create(React.createElement(Harness, { effects() {} })) })
    t.after(() => renderer.unmount())
    let pending
    await act(async () => { pending = current.finalizeOrder('o') })
    await act(async () => renderer.update(React.createElement(Harness, { effects() {} })))
    await act(async () => { reject(error); await pending })
    assert.deepEqual(errors, [])
    assert.equal(current.pending, false)
  }
})
