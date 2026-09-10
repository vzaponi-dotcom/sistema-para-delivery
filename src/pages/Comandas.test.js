import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness, workspaceTables, nodeText, buttonNamed } from '../test-support/renderWorkspace.js'

const currency = (value) => `R$ ${value.toFixed(2)}`
const list = (renderer) => renderer.root.findByProps({ 'aria-label': 'Mesas ativas' })
const detail = (renderer) => renderer.root.findByProps({ 'aria-label': 'Detalhe da comanda' })

test('active tables retain official ordering, textual occupancy and stable comanda summaries', async (t) => {
  const harness = await workspaceHarness(t)
  const { default: Comandas } = await harness.load('/src/pages/Comandas.jsx')
  const renderer = await harness.render(Comandas, { tables: workspaceTables, currency })
  const cards = list(renderer).findAllByType('button')
  assert.equal(cards.length, 2)
  assert.match(nodeText(cards[0]), /Mesa 7.*Ocupada.*Comanda 42.*3 itens.*R\$ 123.45/)
  assert.match(nodeText(cards[1]), /Varanda.*Livre.*Toque para lançar pedido/)
  assert.match(nodeText(detail(renderer)), /Selecione uma mesa ocupada/)
  assert.equal(workspaceTables[0].id, 'free')
})

test('free tables request an order; blocked writes still allow occupied-table consultation', async (t) => {
  const harness = await workspaceHarness(t)
  const { default: Comandas } = await harness.load('/src/pages/Comandas.jsx')
  const orders = [], selections = []
  const props = { tables: workspaceTables, currency, onAddOrder: (id) => orders.push(id), onSelectTable: (id) => selections.push(id) }
  const renderer = await harness.render(Comandas, props)
  await act(async () => list(renderer).findAllByType('button')[1].props.onClick())
  assert.deepEqual(orders, ['free'])
  assert.deepEqual(selections, [])
  await act(async () => renderer.update(React.createElement(Comandas, { ...props, disabled: true })))
  const [occupied, free] = list(renderer).findAllByType('button')
  assert.equal(free.props.disabled, true)
  assert.ok(!occupied.props.disabled)
  await act(async () => { free.props.onClick(); occupied.props.onClick() })
  assert.deepEqual(orders, ['free'])
  assert.deepEqual(selections, ['occupied'])
})

test('mobile back restores list scroll and focus without clearing selection; the same table reopens', async (t) => {
  const harness = await workspaceHarness(t, { mobile: true })
  const { default: Comandas } = await harness.load('/src/pages/Comandas.jsx')
  const listElement = { scrollTop: 0 }
  let focus = ''
  function Workspace() {
    const [selectedTableId, onSelectTable] = React.useState(null)
    return React.createElement(Comandas, { tables: workspaceTables, selectedTableId, onSelectTable, currency })
  }
  const renderer = await harness.render(Workspace, {}, { createNodeMock: (element) => {
    if (element.props['aria-label'] === 'Mesas ativas') return listElement
    return { focus: () => { focus = element.type } }
  } })
  listElement.scrollTop = 240
  await act(async () => list(renderer).props.onScroll({ currentTarget: listElement }))
  await act(async () => list(renderer).findAllByType('button')[0].props.onClick())
  assert.ok(renderer.toJSON().props.className.includes('has-mobile-detail'))
  assert.match(nodeText(detail(renderer)), /Comanda 42.*Mesa 7.*3 itens.*R\$ 123.45/)
  assert.equal(focus, 'h2')
  listElement.scrollTop = 0 // Hiding a scroll container can reset its offset.
  await act(async () => buttonNamed(renderer.root, 'Voltar para mesas').props.onClick())
  assert.ok(!renderer.toJSON().props.className.includes('has-mobile-detail'))
  assert.equal(listElement.scrollTop, 240)
  assert.equal(focus, 'button')
  assert.equal(list(renderer).findAllByType('button')[0].props['aria-pressed'], true)
  await act(async () => list(renderer).findAllByType('button')[0].props.onClick())
  assert.ok(renderer.toJSON().props.className.includes('has-mobile-detail'))
})

test('official refresh updates totals and clears obsolete detail when a table becomes free or inactive', async (t) => {
  const harness = await workspaceHarness(t)
  const { default: Comandas } = await harness.load('/src/pages/Comandas.jsx')
  const props = { tables: workspaceTables, selectedTableId: 'occupied', currency }
  const renderer = await harness.render(Comandas, props)
  const updated = workspaceTables.map((table) => table.id === 'occupied' ? { ...table, openTableTab: { ...table.openTableTab, itemCount: 1, totalCents: 2500 } } : table)
  await act(async () => renderer.update(React.createElement(Comandas, { ...props, tables: updated })))
  assert.match(nodeText(detail(renderer)), /Comanda 42.*1 item.*R\$ 25.00/)
  for (const change of [{ occupancy: 'free', openTableTab: null }, { isActive: false }]) {
    await act(async () => renderer.update(React.createElement(Comandas, { ...props, tables: workspaceTables.map((table) => ({ ...table, ...change })) })))
    assert.match(nodeText(detail(renderer)), /Selecione uma mesa ocupada/)
    assert.ok(!renderer.toJSON().props.className.includes('has-mobile-detail'))
  }
})

test('empty workspace announces absence of active tables', async (t) => {
  const harness = await workspaceHarness(t)
  const { default: Comandas } = await harness.load('/src/pages/Comandas.jsx')
  const renderer = await harness.render(Comandas)
  assert.match(nodeText(renderer.root.findByProps({ role: 'status' })), /Nenhuma mesa ativa/)
})
