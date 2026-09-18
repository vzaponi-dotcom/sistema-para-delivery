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
    assert.equal(Object.hasOwn(routeModule, 'tableTabsFromBootstrap'), false)
  } finally {
    await vite.close()
  }
})
