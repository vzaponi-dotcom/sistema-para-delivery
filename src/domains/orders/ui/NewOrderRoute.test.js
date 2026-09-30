import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { createServer } from 'vite'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

test('new-order route forwards only the live table contract and exposes no bootstrap table-tab helper', async () => {
  const tables = [{ id: 'table-7', isActive: true, occupancy: 'occupied', openTableTab: { id: 'tab-42' } }]
  let receivedProps
  const Probe = (props) => {
    receivedProps = props
    return React.createElement('output', { 'data-route': 'new-order' })
  }

  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  try {
    const routeModule = await vite.ssrLoadModule('/src/domains/orders/ui/NewOrderRoute.jsx')
    const { NewOrderRoute } = routeModule

    await act(async () => {
      create(React.createElement(NewOrderRoute, {
        NewOrderComponent: Probe,
        tables,
        initialTableId: 'table-7',
        expectedTableTabId: 'tab-42',
      }))
    })

    assert.strictEqual(receivedProps.tables, tables)
    assert.equal(receivedProps.initialTableId, 'table-7')
    assert.equal(receivedProps.expectedTableTabId, 'tab-42')
    assert.equal(Object.hasOwn(receivedProps, 'tableTabs'), false)
    assert.equal(Object.hasOwn(routeModule, ['tableTabs', 'FromBootstrap'].join('')), false)
  } finally {
    await vite.close()
  }
})


test('new-order route forwards explicit edit-reservation mode and official edit snapshot without creating a parallel editor', async () => {
  let receivedProps
  const Probe = (props) => {
    receivedProps = props
    return React.createElement('output')
  }
  const reservationContext = {
    id: 'reservation-1',
    orderId: 'order-1',
    orderNumber: 81,
    expectedRevision: 7,
    hasManualPrintHistory: true,
  }
  const initialDraft = {
    type: 'Local',
    selectedTableId: 'table-3',
    localClientId: 'client-2',
    orderDate: '2026-10-10',
    scheduleMode: 'scheduled',
    scheduledTime: '20:30',
    items: [{ lineId: 'reservation:item:0', productId: 'p1', unitPrice: 32, quantity: 2, note: '' }],
    deliveryFee: 0,
    adjustment: { type: 'none', mode: 'fixed', value: 0, reason: '' },
  }

  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  try {
    const { NewOrderRoute } = await vite.ssrLoadModule('/src/domains/orders/ui/NewOrderRoute.jsx')
    await act(async () => {
      create(React.createElement(NewOrderRoute, {
        NewOrderComponent: Probe,
        mode: 'edit-reservation',
        reservationContext,
        initialDraft,
      }))
    })
    assert.equal(receivedProps.mode, 'edit-reservation')
    assert.strictEqual(receivedProps.reservationContext, reservationContext)
    assert.strictEqual(receivedProps.initialDraft, initialDraft)
  } finally {
    await vite.close()
  }
})
