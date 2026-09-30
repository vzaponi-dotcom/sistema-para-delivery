import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { buttonNamed, nodeText, renderWithNavigation, workspaceHarness } from '../../../test-support/renderWorkspace.js'

test('late filter narrows preparation, preserves scheduling, and follows the live clock and search', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Orders } = await h.load('/src/domains/orders/ui/Orders.jsx')
  const now = new Date('2026-09-29T15:00:00Z')
  const orders = [
    { id: 'late', client: 'Cliente atrasado', type: 'Local', status: 'Em preparo', createdAt: '2026-09-29T13:00:00Z' },
    { id: 'fresh', client: 'Cliente recente', type: 'Local', status: 'Em preparo', createdAt: '2026-09-29T14:59:00Z' },
    { id: 'later', client: 'Cliente agendado', type: 'Retirada', status: 'Em preparo', createdAt: '2026-09-29T13:00:00Z', scheduledFor: '2026-09-29T21:00:00Z' },
    { id: 'future', client: 'Cliente amanhã', type: 'Local', status: 'Em preparo', createdAt: '2026-09-29T13:00:00Z', scheduledFor: '2026-09-30T21:00:00Z' },
  ]
  const onFinalizeOrder = () => assert.fail('filter must not finalize an order')
  const Wrapper = ({ clock = now }) => {
    const [search, setSearch] = React.useState('')
    return React.createElement(Orders, { orders, now: clock, search, onSearchChange: setSearch, onFinalizeOrder, currency: String })
  }
  const renderer = await renderWithNavigation(h, Wrapper)
  const lateButton = () => buttonNamed(renderer.root, 'Mostrar apenas pedidos em atraso')
  assert.ok(lateButton(), 'the kitchen exposes an accessible late filter')
  await act(async () => lateButton().props.onClick())
  assert.equal(lateButton().props['aria-pressed'], true)
  assert.match(nodeText(renderer.root), /Cliente atrasado/)
  assert.doesNotMatch(nodeText(renderer.root), /Cliente recente/)
  assert.match(nodeText(renderer.root), /Cliente agendado/)
  assert.match(nodeText(renderer.root), /Cliente amanhã/)
  const input = renderer.root.findByProps({ 'aria-label': 'Buscar pedido' })
  await act(async () => input.props.onChange({ target: { value: 'recente' } }))
  assert.match(nodeText(renderer.root), /Nenhum pedido em atraso nesta busca/)
  await act(async () => input.props.onChange({ target: { value: '' } }))
  await act(async () => buttonNamed(renderer.root, 'Todos').props.onClick())
  assert.match(nodeText(renderer.root), /Cliente recente/)
  await act(async () => lateButton().props.onClick())
  // The filter must be recomputed when a previously on-time order becomes late.
  const { NavigationProvider } = await h.load('/src/app/navigation/NavigationContext.jsx')
  await act(async () => renderer.update(React.createElement(NavigationProvider, {
    activeTab: 'orders', granted: new Set(), implemented: new Set(), requestNavigation() {},
    children: React.createElement(Wrapper, { clock: new Date('2026-09-29T16:00:00Z') }),
  })))
  assert.equal(lateButton().props['aria-pressed'], true)
  assert.match(nodeText(renderer.root), /Cliente recente/)
})
