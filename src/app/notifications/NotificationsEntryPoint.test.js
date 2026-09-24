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

const structuredRelease = {
  id: 'release-structured',
  type: 'release',
  publishedAt: '2026-09-21T20:00:00-03:00',
  title: 'Novidades da Mesiva',
  summary: 'Resumo editorial da release.',
  items: [
    { icon: 'orders', title: 'Pedidos em andamento', description: 'Acompanhe pedidos que ainda precisam de atenção.' },
    { icon: 'unknown-future-icon', title: 'Novidade futura', description: 'Continua legível mesmo com ícone desconhecido.' },
  ],
}

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

test('mobile detail uses only the BottomSheet close action and reopens on the list', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
  const { default: Entry } = await h.load('/src/app/notifications/NotificationsEntryPoint.jsx')
  const renderer = await h.render(Entry, { businessId: 'a', catalog: catalog(2), storage: h.localStorage })
  await act(async () => buttonNamed(renderer.root, 'Fechar').props.onClick())
  assert.ok(buttonNamed(renderer.root, 'Notificações, 1 não lida'))
  await act(async () => buttonNamed(renderer.root, 'Notificações, 1 não lida').props.onClick())
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 1)
  await act(async () => buttonNamed(renderer.root, 'Release 2, n\u00e3o lida').props.onClick())
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 1)
  assert.equal(buttonNamed(renderer.root, 'Voltar'), undefined)
  assert.ok(buttonNamed(renderer.root, 'Fechar'))
  assert.match(nodeText(renderer.root), /Detalhe da melhoria/)
  await act(async () => buttonNamed(renderer.root, 'Fechar').props.onClick())
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0)
  await act(async () => buttonNamed(renderer.root, 'Notificações').props.onClick())
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

test('release notes render structured items as a semantic list with configured and fallback icons', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Entry } = await h.load('/src/app/notifications/NotificationsEntryPoint.jsx')
  const renderer = await h.render(Entry, { businessId: 'a', catalog: [structuredRelease], storage: h.localStorage })

  assert.ok(buttonNamed(renderer.root, 'Fechar'))
  const list = renderer.root.findByProps({ className: 'release-notes-list' })
  assert.equal(list.type, 'ul')
  const items = list.findAllByType('li')
  assert.equal(items.length, 2)
  assert.match(nodeText(items[0]), /Pedidos em andamento.*Acompanhe pedidos que ainda precisam de atenção\./)
  assert.match(nodeText(items[1]), /Novidade futura.*Continua legível mesmo com ícone desconhecido\./)
  assert.equal(items[0].findByProps({ className: 'release-notes-item-icon' }).props['data-icon'], 'orders')
  assert.equal(items[1].findByProps({ className: 'release-notes-item-icon' }).props['data-icon'], 'details')
  assert.equal(items.flatMap((item) => item.findAllByType('svg')).length, 2)
})

test('mobile structured release keeps the existing sheet close flow without a back action', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
  const { default: Entry } = await h.load('/src/app/notifications/NotificationsEntryPoint.jsx')
  const renderer = await h.render(Entry, { businessId: 'a', catalog: [structuredRelease], storage: h.localStorage })

  assert.ok(buttonNamed(renderer.root, 'Fechar'))
  assert.equal(buttonNamed(renderer.root, 'Voltar'), undefined)
  assert.equal(renderer.root.findByProps({ className: 'release-notes-list' }).type, 'ul')
})


test('automatic release notice omits the redundant one-time device message', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Entry } = await h.load('/src/app/notifications/NotificationsEntryPoint.jsx')
  const renderer = await h.render(Entry, { businessId: 'a', catalog: catalog(1), storage: h.localStorage })

  assert.ok(buttonNamed(renderer.root, 'Entendi'))
  assert.ok(buttonNamed(renderer.root, 'Ver histórico'))
  assert.doesNotMatch(nodeText(renderer.root), /Este aviso será exibido apenas uma vez neste dispositivo\./)
})


test('automatic structured release shows its own release heading inside the generic Novidades modal', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Entry } = await h.load('/src/app/notifications/NotificationsEntryPoint.jsx')
  const release = {
    ...structuredRelease,
    title: 'Nova TV da Cozinha',
    items: [
      { icon: 'kitchen', title: 'Uma tela feita para a cozinha', description: 'Informações operacionais em uma tela dedicada.' },
      { icon: 'sound', title: 'Alertas sonoros para novos pedidos', description: 'O clique inicial libera o áudio do navegador da TV.' },
    ],
  }
  const renderer = await h.render(Entry, { businessId: 'a', catalog: [release], storage: h.localStorage })

  const dialog = renderer.root.findByProps({ role: 'dialog' })
  assert.match(nodeText(dialog), /Novidades da Mesiva/)
  assert.match(nodeText(dialog), /Nova TV da Cozinha/)
  const icons = dialog.findAllByProps({ className: 'release-notes-item-icon' })
  assert.equal(icons[0].props['data-icon'], 'chef-hat')
  assert.equal(icons[1].props['data-icon'], 'volume-on')
})


test('release tour advances with buttons, dots and mobile swipe without changing legacy item releases', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
  const { default: Entry } = await h.load('/src/app/notifications/NotificationsEntryPoint.jsx')
  const tourRelease = {
    id: 'release-tour',
    type: 'release',
    publishedAt: '2026-09-22T22:55:00-03:00',
    title: 'Nova TV da Cozinha',
    summary: 'Resumo do tour.',
    slides: [
      { icon: 'kitchen', title: 'Primeiro slide', description: 'Primeira descrição.', image: '/release/tv.jpg', imageAlt: 'TV' },
      { icon: 'pairing', title: 'Segundo slide', description: 'Segunda descrição.', image: '/release/tv.jpg', imageAlt: 'Conexão' },
      { icon: 'sound', title: 'Terceiro slide', description: 'Terceira descrição.', image: '/release/tv.jpg', imageAlt: 'Som' },
    ],
  }
  const renderer = await h.render(Entry, { businessId: 'a', catalog: [tourRelease], storage: h.localStorage })

  assert.match(nodeText(renderer.root), /Primeiro slide/)
  assert.ok(buttonNamed(renderer.root, 'Próximo'))
  assert.ok(buttonNamed(renderer.root, 'Pular'))

  await act(async () => buttonNamed(renderer.root, 'Próximo').props.onClick())
  assert.match(nodeText(renderer.root), /Segundo slide/)
  assert.ok(buttonNamed(renderer.root, 'Anterior'))

  const tour = renderer.root.findByProps({ className: 'release-tour' })
  await act(async () => {
    tour.props.onTouchStart({ touches: [{ clientX: 250 }] })
    tour.props.onTouchEnd({ changedTouches: [{ clientX: 120 }] })
  })
  assert.match(nodeText(renderer.root), /Terceiro slide/)
  assert.ok(buttonNamed(renderer.root, 'Entendi'))

  await act(async () => buttonNamed(renderer.root, 'Ir para slide 1').props.onClick())
  assert.match(nodeText(renderer.root), /Primeiro slide/)
})

test('tour skip marks the automatic release read instead of opening a queue of slides or releases', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Entry } = await h.load('/src/app/notifications/NotificationsEntryPoint.jsx')
  const tourRelease = {
    id: 'release-tour',
    type: 'release',
    publishedAt: '2026-09-22T22:55:00-03:00',
    title: 'Nova TV da Cozinha',
    summary: 'Resumo do tour.',
    slides: [{ icon: 'kitchen', title: 'Tour', description: 'Descrição.', image: '/release/tv.jpg', imageAlt: 'TV' }],
  }
  const renderer = await h.render(Entry, { businessId: 'a', catalog: [tourRelease], storage: h.localStorage })
  assert.ok(buttonNamed(renderer.root, 'Pular'))
  await act(async () => buttonNamed(renderer.root, 'Pular').props.onClick())
  assert.equal(renderer.root.findAllByProps({ className: 'release-tour' }).length, 0)
  assert.ok(buttonNamed(renderer.root, 'Notificações'))
})


test('slide releases remain visible when reopened from the mobile notification history', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
  const { default: Entry } = await h.load('/src/app/notifications/NotificationsEntryPoint.jsx')
  const tourRelease = {
    id: 'release-tour-history',
    type: 'release',
    publishedAt: '2026-09-22T22:55:00-03:00',
    title: 'Nova TV da Cozinha',
    summary: 'Resumo do tour.',
    slides: [
      { icon: 'kitchen', title: 'Primeiro slide', description: 'Primeira descrição.', image: '/release/tv.jpg', imageAlt: 'TV' },
      { icon: 'notes', title: 'Segundo slide', description: 'Segunda descrição.', image: '/release/tv.jpg', imageAlt: 'Itens' },
    ],
  }
  const renderer = await h.render(Entry, { businessId: 'a', catalog: [tourRelease], storage: h.localStorage })

  await act(async () => buttonNamed(renderer.root, 'Pular').props.onClick())
  await act(async () => buttonNamed(renderer.root, 'Notificações').props.onClick())
  await act(async () => buttonNamed(renderer.root, 'Nova TV da Cozinha, lida').props.onClick())

  assert.match(nodeText(renderer.root), /Nova TV da Cozinha.*Primeiro slide.*Primeira descrição/)
  assert.ok(buttonNamed(renderer.root, 'Próximo'))
  assert.equal(buttonNamed(renderer.root, 'Pular'), undefined)
  assert.equal(buttonNamed(renderer.root, 'Voltar'), undefined)
})
