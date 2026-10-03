import test from 'node:test'
import assert from 'node:assert/strict'
import { setup, manager, users, roles, response, nodeText } from '../../../test-support/accessUi.js'

test('technical resource reference starts collapsed while audit action and actor remain readable', async t => {
  const { screen } = await setup(t, 'ActivityLog', { sessionContext: manager }, async url => response(url === '/api/access/users' ? { users, roles } : { items: [{ id: 'e1', actor: { type: 'user', displayName: 'Otávio' }, action: 'order.created', outcome: 'success', occurredAt: '2026-10-01T13:00:00Z', resourceType: 'order', resourceId: 'technical-order-id' }], nextCursor: null }))
  const references = screen.root.findAllByType('details')
  assert.equal(references.length, 1, 'technical reference has a disclosure')
  assert.notEqual(references[0].props.open, true)
  assert.match(nodeText(references[0]), /technical-order-id/)
  const row = screen.root.findAllByType('li')[0]
  const visibleText = row.children.filter(n => typeof n === 'string' || n.type !== 'details').map(nodeText).join('')
  assert.match(visibleText, /Otávio/)
  assert.match(visibleText, /Pedido criado/)
  assert.doesNotMatch(visibleText, /technical-order-id/)
})
