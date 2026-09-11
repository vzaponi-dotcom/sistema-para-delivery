import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act } from 'react-test-renderer'
import { buttonNamed, nodeText, workspaceHarness } from './test-support/renderWorkspace.js'

const source = (tabId) => ({
  id: 'source', name: 'Mesa 1', isActive: true, occupancy: 'occupied', sortOrder: 1,
  openTableTab: { id: tabId, number: tabId === 'A' ? 37 : 38 },
})
const destination = { id: 'destination', name: 'Mesa 2', isActive: true, occupancy: 'free', sortOrder: 2, openTableTab: null }

const openConfirmation = async (renderer) => {
  const destinationOption = renderer.root.findAllByProps({ role: 'radio' }).find((node) => nodeText(node).includes('Mesa 2'))
  await act(async () => destinationOption.props.onClick())
  await act(async () => buttonNamed(renderer.root, 'Continuar').props.onClick())
}

test('refresh after opening A never retargets the confirmed intention to B', async (t) => {
  const h = await workspaceHarness(t)
  const { default: TableTransferDialog } = await h.load('/src/components/TableTransferDialog.jsx')
  const calls = []
  const props = { sourceTable: source('A'), tables: [source('A'), destination], disabled: false, onClose() {}, onTransfer: async (...args) => { calls.push(args); return true } }
  const renderer = await h.render(TableTransferDialog, props)
  await openConfirmation(renderer)

  await act(async () => renderer.update(React.createElement(TableTransferDialog, { ...props, tables: [source('B'), destination] })))
  const confirm = renderer.root.findAllByType('button').filter((node) => nodeText(node) === 'Transferir comanda').at(-1)
  await act(async () => confirm.props.onClick())

  assert.deepEqual(calls, [])
})

test('double confirmation sends at most one request with the captured identity', async (t) => {
  const h = await workspaceHarness(t)
  const { default: TableTransferDialog } = await h.load('/src/components/TableTransferDialog.jsx')
  const calls = []
  let resolveTransfer
  const transfer = new Promise((resolve) => { resolveTransfer = resolve })
  const renderer = await h.render(TableTransferDialog, {
    sourceTable: source('A'), tables: [source('A'), destination], disabled: false, onClose() {},
    onTransfer: async (...args) => { calls.push(args); return transfer },
  })
  await openConfirmation(renderer)

  const confirm = buttonNamed(renderer.root, 'Transferir comanda')
  await act(async () => {
    const first = confirm.props.onClick()
    const second = confirm.props.onClick()
    resolveTransfer(true)
    await Promise.all([first, second])
  })

  assert.deepEqual(calls, [['source', 'destination', 'A']])
})

test('App refreshes official data after an identity conflict without retrying the transfer', async (t) => {
  const h = await workspaceHarness(t)
  let bootstrapCalls = 0
  const transferBodies = []
  globalThis.fetch = async (path, options = {}) => {
    if (path === '/api/auth/session') return new Response(JSON.stringify({ authenticated: true }), { status: 200 })
    if (path === '/api/bootstrap') {
      bootstrapCalls += 1
      return new Response(JSON.stringify({
        tables: [source('A'), destination], orders: [], movements: [], products: [], clients: [], tableTabs: [], financeSettings: null,
      }), { status: 200 })
    }
    if (path === '/api/printing/stations') return new Response(JSON.stringify({ stations: [{ id: 'test-station', platform: 'other', isPrimary: false, autoPrintEnabled: false }] }), { status: 200 })
    if (path === '/api/printing/jobs?limit=100') return new Response(JSON.stringify({ jobs: [] }), { status: 200 })
    if (path === '/api/tables/source/transfer' && options.method === 'POST') {
      transferBodies.push(JSON.parse(options.body))
      return new Response(JSON.stringify({ error: { code: 'TABLE_TAB_CHANGED', message: 'A comanda mudou.' } }), { status: 409 })
    }
    throw new Error(`Unexpected request: ${path}`)
  }
  const { default: App } = await h.load('/src/App.jsx')
  const renderer = await h.render(App)
  await act(async () => buttonNamed(renderer.root.findByProps({ 'aria-label': 'Menu principal' }), 'Mesas').props.onClick())
  await act(async () => buttonNamed(renderer.root, 'Transferir comanda').props.onClick())
  await openConfirmation(renderer)
  const bootstrapCallsBeforeConflict = bootstrapCalls
  const confirm = renderer.root.findAllByType('button').filter((node) => nodeText(node) === 'Transferir comanda').at(-1)
  await act(async () => confirm.props.onClick())

  assert.deepEqual(transferBodies, [{ destinationTableId: 'destination', expectedTableTabId: 'A' }])
  assert.equal(bootstrapCalls, bootstrapCallsBeforeConflict + 1)
})
