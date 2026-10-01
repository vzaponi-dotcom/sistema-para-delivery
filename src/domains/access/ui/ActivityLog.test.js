import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { setup, manager, users, roles, response, fill, submit, act, nodeText, buttonNamed } from '../../../test-support/accessUi.js'
test('activity sends exact filters and opaque pagination; changes reset pagination', async t => {
  const requests = []
  const { screen } = await setup(t, 'ActivityLog', { sessionContext: manager }, async url => {
    requests.push(url)
    return response(url === '/api/access/users' ? { users, roles } : { items: [{ id: 'e1', actor: { type: 'legacy', displayName: 'bogus' }, action: 'order.created', occurredAt: '2026-09-30T12:00:00Z', outcome: 'success' }], nextCursor: 'opaque+/=' })
  })
  await act(async () => screen.root.findByProps({ role: 'combobox', 'aria-label': 'Pessoa' }).props.onClick())
  await act(async () => screen.root.findAllByProps({ role: 'option' }).find(n => nodeText(n) === 'Otávio').props.onClick())
  await fill(screen, 'from', '2026-09-29'); await fill(screen, 'to', '2026-09-30')
  await act(async () => screen.root.findByProps({ role: 'combobox', 'aria-label': 'Tipo' }).props.onClick())
  await act(async () => screen.root.findAllByProps({ role: 'option' }).find(n => nodeText(n) === 'Pedido criado').props.onClick())
  await submit(screen)
  let query = new URL(requests.at(-1), 'http://localhost').searchParams
  assert.equal(query.get('userId'), 'o'); assert.equal(query.get('type'), 'order.created'); assert.equal(query.get('from'), '2026-09-29T00:00:00-03:00'); assert.equal(query.get('to'), '2026-09-30T23:59:59.999-03:00'); assert.equal(query.has('cursor'), false)
  await act(async () => buttonNamed(screen.root, 'Próxima página').props.onClick())
  query = new URL(requests.at(-1), 'http://localhost').searchParams
  assert.equal(query.get('cursor'), 'opaque+/=')
  assert.match(nodeText(screen.root), /Acesso legado/)
  await submit(screen)
  assert.equal(new URL(requests.at(-1), 'http://localhost').searchParams.has('cursor'), false)
})
test('activity refuses operators without requests', async t => {
  const { screen } = await setup(t, 'ActivityLog', { sessionContext: { user: { id: 'o' }, capabilities: [] } }, () => assert.fail('private request'))
  assert.match(nodeText(screen.root), /Acesso negado/)
})
test('callback-only parent render preserves filtered cursor items without another read', async t => {
  const requests = []
  const { screen, Component } = await setup(t, 'ActivityLog', { sessionContext: manager, onApiError() {} }, async url => {
    requests.push(url)
    return response(url === '/api/access/users' ? { users, roles } : { items: [{ id: url, actor: { type: 'user', displayName: url.includes('cursor=') ? 'Página filtrada' : 'Primeira página' }, occurredAt: '2026-09-30', action: 'order.created' }], nextCursor: 'page-two' })
  })
  await fill(screen, 'from', '2026-09-29'); await submit(screen)
  await act(async () => buttonNamed(screen.root, 'Próxima página').props.onClick())
  const before = requests.length
  await act(async () => screen.update(React.createElement(Component, { sessionContext: manager, onApiError() {} })))
  assert.equal(requests.length, before)
  assert.match(nodeText(screen.root), /Página filtrada/)
  assert.equal(screen.root.findAllByType('input').find(n => n.props.name === 'from').props.value, '2026-09-29')
})
test('activity offers details only for a resolvable permitted resource', async t => {
  const opened = []
  const { screen } = await setup(t, 'ActivityLog', { sessionContext: manager, canOpenResource: item => item.resourceId === 'allowed', onOpenResource: item => opened.push(item.resourceId) }, async url => response(url === '/api/access/users' ? { users, roles } : { items: [
    { id: 'one', actor: { type: 'system' }, action: 'order.created', resourceType: 'order', resourceId: 'allowed' },
    { id: 'two', actor: { type: 'system' }, action: 'order.created', resourceType: 'order', resourceId: 'missing' },
  ], nextCursor: null }))
  const details = screen.root.findAllByType('button').filter(node => nodeText(node) === 'Abrir detalhe')
  assert.equal(details.length, 1)
  await act(async () => details[0].props.onClick())
  assert.deepEqual(opened, ['allowed'])
})

test('activity translates observed outcome without implying physical printing', async t => {
  const { screen } = await setup(t, 'ActivityLog', { sessionContext: manager }, async url => response(url === '/api/access/users' ? { users, roles } : { items: [{ id: 'p', action: 'printing.outcome.observed', outcome: 'spooler_complete', occurredAt: '2026-09-30' }], nextCursor: null }))
  assert.match(nodeText(screen.root), /Resultado de impress\u00e3o observado/)
  assert.match(nodeText(screen.root), /Conclu\u00eddo na fila do sistema/)
})
