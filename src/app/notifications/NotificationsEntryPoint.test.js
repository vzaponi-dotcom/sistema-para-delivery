import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness, buttonNamed, nodeText } from '../../test-support/renderWorkspace.js'

const catalog = (count) => Array.from({ length: count }, (_, index) => ({
  id: `release-${count - index}`,
  type: 'release',
  publishedAt: new Date(Date.UTC(2026, 8, 21, 12, 0, -index)).toISOString(),
  title: `Release ${count - index}`,
  summary: `Resumo ${count - index}`,
  sections: [{ title: 'Melhoria', body: 'Detalhe da melhoria' }],
}))

test('desktop bell shows unread count, paginates 20 at a time and opens detail', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Entry } = await h.load('/src/app/notifications/NotificationsEntryPoint.jsx')
  const renderer = await h.render(Entry, { businessId: 'a', catalog: catalog(45), storage: h.localStorage })
  assert.ok(buttonNamed(renderer.root, 'Notificações, 1 não lida'))
  assert.ok(buttonNamed(renderer.root, 'Entendi'))
  await act(async () => buttonNamed(renderer.root, 'Entendi').props.onClick())
  await act(async () => buttonNamed(renderer.root, 'Notificações').props.onClick())
  assert.ok(renderer.root.findByProps({ className: 'modal-card notification-center-drawer' }))
  assert.equal(renderer.root.findAllByProps({ className: 'notification-list-item' }).length, 20)
  await act(async () => buttonNamed(renderer.root, 'Ver mais notificações').props.onClick())
  assert.equal(renderer.root.findAllByProps({ className: 'notification-list-item' }).length, 40)
  await act(async () => buttonNamed(renderer.root, 'Ver mais notificações').props.onClick())
  assert.equal(renderer.root.findAllByProps({ className: 'notification-list-item' }).length, 45)
  assert.equal(buttonNamed(renderer.root, 'Ver mais notificações'), undefined)
  await act(async () => buttonNamed(renderer.root, 'Release 44, lida').props.onClick())
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 2)
  assert.match(nodeText(renderer.root), /Detalhe da melhoria/)
})

test('mobile center swaps list for detail in the same BottomSheet', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
  const { default: Entry } = await h.load('/src/app/notifications/NotificationsEntryPoint.jsx')
  const renderer = await h.render(Entry, { businessId: 'a', catalog: catalog(2), storage: h.localStorage })
  await act(async () => buttonNamed(renderer.root, 'Fechar').props.onClick())
  assert.ok(buttonNamed(renderer.root, 'Notificações, 1 não lida'))
  await act(async () => buttonNamed(renderer.root, 'Notificações, 1 não lida').props.onClick())
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 1)
  await act(async () => buttonNamed(renderer.root, 'Release 2, n\u00e3o lida').props.onClick())
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 1)
  assert.ok(buttonNamed(renderer.root, 'Voltar'))
  assert.match(nodeText(renderer.root), /Detalhe da melhoria/)
  await act(async () => buttonNamed(renderer.root, 'Voltar').props.onClick())
  assert.ok(buttonNamed(renderer.root, 'Release 2, lida'))
})

test('automatic history action marks presented but keeps unread', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Entry } = await h.load('/src/app/notifications/NotificationsEntryPoint.jsx')
  const renderer = await h.render(Entry, { businessId: 'a', catalog: catalog(1), storage: h.localStorage })
  await act(async () => buttonNamed(renderer.root, 'Ver histórico').props.onClick())
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 1)
  assert.ok(buttonNamed(renderer.root, 'Notificações, 1 não lida'))
})

test('bell visually caps unread count at 99+', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Entry } = await h.load('/src/app/notifications/NotificationsEntryPoint.jsx')
  const items = catalog(101)
  h.localStorage.setItem('delivery-notifications:v1:a', JSON.stringify({ version: 1, knownIds: items.map((item) => item.id), presentedIds: items.map((item) => item.id), readIds: [] }))
  const renderer = await h.render(Entry, { businessId: 'a', catalog: items, storage: h.localStorage })
  assert.ok(buttonNamed(renderer.root, 'Notificações, 101 não lidas'))
  assert.equal(renderer.root.findByProps({ className: 'notification-bell-badge' }).children.join(''), '99+')
})

test('notification entry point waits for an authenticated business identity', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Entry } = await h.load('/src/app/notifications/NotificationsEntryPoint.jsx')
  const renderer = await h.render(Entry, { catalog: catalog(1), storage: h.localStorage })
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0)
  assert.equal(renderer.root.findAllByProps({ className: 'notification-bell icon-button icon-button-neutral' }).length, 0)
})

test('center item labels announce whether each notification is read', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Entry } = await h.load('/src/app/notifications/NotificationsEntryPoint.jsx')
  const renderer = await h.render(Entry, { businessId: 'a', catalog: catalog(2), storage: h.localStorage })
  await act(async () => buttonNamed(renderer.root, 'Ver hist\u00f3rico').props.onClick())
  const items = renderer.root.findAllByProps({ className: 'notification-list-item' })
  assert.match(items[0].findByType('button').props['aria-label'] || '', /Release 2.*n\u00e3o lida/i)
  assert.match(items[1].findByType('button').props['aria-label'] || '', /Release 1.*lida/i)
})
