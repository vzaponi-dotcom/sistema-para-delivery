import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import React from 'react'
import { workspaceHarness, nodeText, buttonNamed } from '../../../../test-support/renderWorkspace.js'

const order = {
  id: 'ticket', orderNumber: 42, client: 'Ana Oliveira', type: 'Entrega',
  createdAt: '2026-10-04T15:00:00Z', status: 'Em preparo',
  items: [
    { id: 'first', name: 'Frango', quantity: 2, note: 'Sem cebola' },
    { id: 'second', name: 'Suco', quantity: 1, note: 'Sem gelo' },
    { id: 'third', name: 'Frango', quantity: 1, note: 'Molho à parte' },
  ],
}
const now = new Date('2026-10-04T15:12:00Z')

test('each kitchen item keeps its quantity and its own visible note, including repeated products', async t => {
  const h = await workspaceHarness(t)
  const { default: KitchenTicket } = await h.load('/src/domains/orders/ui/components/KitchenTicket.jsx')
  const rendered = await h.render(KitchenTicket, { entry: { order, phase: 'preparing', timingState: 'on-time' }, now })
  const lines = rendered.root.findAllByType('li')
  assert.equal(lines.length, 3)
  for (const [index, note] of ['Sem cebola', 'Sem gelo', 'Molho à parte'].entries()) {
    assert.ok(nodeText(lines[index]).includes(note))
    assert.ok(nodeText(lines[index]).includes(`${order.items[index].quantity}×`))
    assert.equal(lines[index].findAllByType('svg').length, 1, 'note has a decorative arrow')
    assert.doesNotMatch(nodeText(lines[index]), /Obs\.:/)
    for (const other of order.items.filter((_, itemIndex) => itemIndex !== index)) assert.ok(!nodeText(lines[index]).includes(other.note))
  }
})

test('the action footer starts with cancellation and keeps the existing callbacks and disabled state', async t => {
  const h = await workspaceHarness(t)
  const { default: KitchenTicket } = await h.load('/src/domains/orders/ui/components/KitchenTicket.jsx')
  const calls = []
  const props = { entry: { order, phase: 'preparing', timingState: 'on-time' }, now,
    onCancel: value => calls.push(`cancel:${value.id}`), onDetails: value => calls.push(`details:${value.id}`), onFinalize: value => calls.push(`finish:${value.id}`) }
  const rendered = await h.render(KitchenTicket, props)
  const footer = rendered.root.findByType('footer')
  assert.equal(footer.findAllByType('button')[0].props['aria-label'], 'Cancelar pedido')
  await act(async () => buttonNamed(footer, 'Cancelar pedido').props.onClick())
  await act(async () => buttonNamed(footer, 'Exibir detalhes').props.onClick())
  await act(async () => footer.findAllByType('button')[2].props.onClick())
  assert.deepEqual(calls, ['cancel:ticket', 'details:ticket', 'finish:ticket'])
  await act(async () => rendered.update(React.createElement(KitchenTicket, { ...props, disabled: true })))
  assert.ok(rendered.root.findAllByType('button').every(button => button.props.disabled))
})

test('scheduled tickets show scheduled status and never offer finalization; late tickets keep the warning', async t => {
  const h = await workspaceHarness(t)
  const { default: KitchenTicket } = await h.load('/src/domains/orders/ui/components/KitchenTicket.jsx')
  const scheduled = await h.render(KitchenTicket, { entry: { order: { ...order, scheduledFor: '2026-10-04T17:00:00Z' }, phase: 'scheduled' }, now, onFinalize() {}, onCancel() {} })
  assert.equal(scheduled.root.findAllByType('button').length, 2)
  assert.match(scheduled.root.findByType('article').props.className, /kitchen-ticket-scheduled/)
  const late = await h.render(KitchenTicket, { entry: { order, phase: 'preparing', timingState: 'late', isLate: true }, now })
  assert.match(late.root.findByType('article').props.className, /kitchen-ticket-overdue/)
  assert.ok(nodeText(late.root).includes('Fora do prazo'))
})
