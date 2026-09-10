import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { createServer } from 'vite'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

test('new-order route preserves bootstrap table tabs and operational callbacks for its consumer', async () => {
  const bootstrapTableTabs = [{ id: 'tab-42', tableId: 'table-7', number: 42, status: 'open' }]
  const onCancel = () => {}
  const onCreateClient = async () => null
  const onSubmit = async () => false
  const onDraftDirtyChange = () => {}
  let receivedProps
  const CapturingNewOrder = (props) => {
    receivedProps = props
    return React.createElement('output', { 'data-route': 'new-order' })
  }

  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  try {
    const { NewOrderRoute, tableTabsFromBootstrap } = await vite.ssrLoadModule('/src/pages/NewOrderRoute.jsx')
    await act(async () => {
      create(React.createElement(NewOrderRoute, {
        clients: [],
        products: [],
        tables: [],
        tableTabs: tableTabsFromBootstrap({ tableTabs: bootstrapTableTabs }),
        currency: (value) => `R$ ${value}`,
        disabled: false,
        onCancel,
        onCreateClient,
        onSubmit,
        onDraftDirtyChange,
        NewOrderComponent: CapturingNewOrder,
      }))
    })

    assert.equal(receivedProps.tableTabs, bootstrapTableTabs)
    assert.equal(receivedProps.onCancel, onCancel)
    assert.equal(receivedProps.onCreateClient, onCreateClient)
    assert.equal(receivedProps.onSubmit, onSubmit)
    assert.equal(receivedProps.onDraftDirtyChange, onDraftDirtyChange)
  } finally {
    await vite.close()
  }
})
