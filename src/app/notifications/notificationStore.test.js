import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeNotificationCatalog, SYSTEM_NOTIFICATIONS, CURRENT_RELEASE } from './notificationCatalog.js'
import { notificationStorageKey, loadNotificationState, saveNotificationState, markPresented, markRead, getUnreadCount, getAutomaticNotification } from './notificationStore.js'

const release = (id, publishedAt = '2026-09-21T20:00:00-03:00') => ({ id, type: 'release', publishedAt, title: id, summary: `${id} summary`, sections: [] })
const memoryStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial))
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
}

test('first device baseline reads older releases but leaves only latest unread and unpresented', () => {
  const catalog = normalizeNotificationCatalog([release('new', '2026-09-21T20:00:00-03:00'), release('old', '2026-09-01T20:00:00-03:00')])
  const state = loadNotificationState({ storage: memoryStorage(), businessId: 'amor-e-sabor', catalog })
  assert.deepEqual(state.knownIds, ['new', 'old'])
  assert.deepEqual(state.readIds, ['old'])
  assert.deepEqual(state.presentedIds, ['old'])
  assert.equal(getAutomaticNotification(catalog, state).id, 'new')
  assert.equal(getUnreadCount(catalog, state), 1)
  assert.equal(CURRENT_RELEASE, SYSTEM_NOTIFICATIONS[0])
})

test('malformed persisted JSON degrades to a safe baseline', () => {
  const storage = memoryStorage({ 'delivery-notifications:v1:amor-e-sabor': '{bad-json' })
  const state = loadNotificationState({ storage, businessId: 'amor-e-sabor', catalog: [release('new')] })
  assert.equal(state.version, 1)
  assert.deepEqual(state.readIds, [])
})

test('storage read/write exceptions never escape', () => {
  const storage = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('quota') } }
  const state = loadNotificationState({ storage, businessId: 'amor-e-sabor', catalog: [release('new')] })
  assert.doesNotThrow(() => saveNotificationState({ storage, businessId: 'amor-e-sabor', state }))
  assert.equal(saveNotificationState({ storage, businessId: 'amor-e-sabor', state }), false)
})

test('different business IDs use different keys', () => {
  assert.equal(notificationStorageKey('a'), 'delivery-notifications:v1:a')
  assert.equal(notificationStorageKey('b'), 'delivery-notifications:v1:b')
  assert.equal(notificationStorageKey(''), null)
})

test('invalid and duplicate catalog entries are ignored without crashing', () => {
  const catalog = normalizeNotificationCatalog([release('same', '2026-09-21T20:00:00-03:00'), release('same', '2026-09-20T20:00:00-03:00'), { id: '', title: 'invalid' }])
  assert.equal(catalog.length, 1)
  assert.equal(catalog[0].id, 'same')
})

test('invalid release sections are isolated from the renderable catalog', () => {
  const catalog = normalizeNotificationCatalog([
    { ...release('bad'), sections: [null] },
    { ...release('also-bad'), sections: [{ title: 'Missing body' }] },
    release('good'),
  ])
  assert.deepEqual(catalog.map((item) => item.id), ['good'])
})

test('current release is the dedicated Kitchen TV tour while the previous release keeps the item format', () => {
  const [releaseItem, previousRelease] = normalizeNotificationCatalog(SYSTEM_NOTIFICATIONS)

  assert.equal(releaseItem.id, 'release-2026-09-kitchen-tv')
  assert.equal(releaseItem.title, 'Nova TV da Cozinha')
  assert.equal(releaseItem.items.length, 0)
  assert.equal(releaseItem.slides.length, 5)
  assert.deepEqual(releaseItem.slides.map((slide) => slide.title), [
    'Uma tela feita para a cozinha',
    'Conecte a TV em poucos passos',
    'Pedidos legíveis à distância',
    'Itens e observações sempre visíveis',
    'Alertas e acesso sob controle',
  ])
  assert.deepEqual(releaseItem.slides.map((slide) => slide.image), [
    '/release/kitchen-tv-32.jpg',
    '/release/kitchen-tv-pairing.svg',
    '/release/kitchen-tv-32.jpg',
    '/release/kitchen-tv-details.svg',
    '/release/kitchen-tv-access.svg',
  ])
  assert.equal(previousRelease.id, 'release-2026-09-operation-shell')
  assert.equal(previousRelease.items.length, 3)
  assert.equal(previousRelease.slides.length, 0)
  assert.equal(CURRENT_RELEASE, SYSTEM_NOTIFICATIONS[0])
})

test('only the newest unpresented release opens automatically even when an older release remains unread', () => {
  const catalog = normalizeNotificationCatalog([
    release('kitchen-tv', '2026-09-22T22:55:00-03:00'),
    release('operation-shell', '2026-09-21T23:00:00-03:00'),
  ])
  const storage = memoryStorage({
    'delivery-notifications:v1:a': JSON.stringify({
      version: 1,
      knownIds: ['operation-shell'],
      presentedIds: ['operation-shell'],
      readIds: [],
    }),
  })
  const state = loadNotificationState({ storage, businessId: 'a', catalog })

  assert.equal(getAutomaticNotification(catalog, state).id, 'kitchen-tv')
  assert.equal(getUnreadCount(catalog, state), 2)
  const afterKitchenPresented = markPresented(state, 'kitchen-tv')
  assert.equal(getAutomaticNotification(catalog, afterKitchenPresented), null)
  assert.equal(getUnreadCount(catalog, afterKitchenPresented), 2)
})

test('legacy sections normalize into renderable items without weakening new item validation', () => {
  const [legacy] = normalizeNotificationCatalog([{
    ...release('legacy'),
    sections: [{ title: 'Melhoria', body: 'Detalhe da melhoria' }],
  }])
  const invalidNew = normalizeNotificationCatalog([{
    ...release('invalid-new'),
    items: [{ icon: 'bell', title: 'Sem descrição', description: '' }],
  }])

  assert.deepEqual(legacy.items, [
    { icon: 'details', title: 'Melhoria', description: 'Detalhe da melhoria' },
  ])
  assert.deepEqual(invalidNew, [])
})

test('persisted state prunes orphan IDs and discovers new releases unread', () => {
  const storage = memoryStorage({ 'delivery-notifications:v1:a': JSON.stringify({ version: 1, knownIds: ['old', 'orphan'], readIds: ['old', 'orphan'], presentedIds: ['old', 'orphan'] }) })
  const catalog = normalizeNotificationCatalog([release('new'), release('old', '2026-09-01T20:00:00-03:00')])
  const state = loadNotificationState({ storage, businessId: 'a', catalog })
  assert.deepEqual(state.knownIds, ['new', 'old'])
  assert.deepEqual(state.readIds, ['old'])
  assert.deepEqual(state.presentedIds, ['old'])
  assert.equal(getUnreadCount(catalog, state), 1)
})

test('marking presented keeps unread; marking read also marks presented', () => {
  const catalog = [release('new')]
  const baseline = loadNotificationState({ storage: memoryStorage(), businessId: 'a', catalog })
  const presented = markPresented(baseline, 'new')
  assert.equal(getAutomaticNotification(catalog, presented), null)
  assert.equal(getUnreadCount(catalog, presented), 1)
  const read = markRead(presented, 'new')
  assert.deepEqual(read.presentedIds, ['new'])
  assert.deepEqual(read.readIds, ['new'])
  assert.equal(getUnreadCount(catalog, read), 0)
})


test('invalid slide releases are isolated without weakening item releases', () => {
  const catalog = normalizeNotificationCatalog([
    { ...release('bad-slide'), slides: [{ icon: 'kitchen', title: 'Sem imagem', description: 'Inválido', image: '', imageAlt: '' }] },
    release('good-item'),
  ])
  assert.deepEqual(catalog.map((item) => item.id), ['good-item'])
})


test('mixed slide and item releases are rejected to keep one presentation contract per release', () => {
  const catalog = normalizeNotificationCatalog([{
    ...release('mixed'),
    items: [{ icon: 'orders', title: 'Item', description: 'Descrição' }],
    slides: [{ icon: 'kitchen', title: 'Slide', description: 'Descrição', image: '/slide.svg', imageAlt: 'Slide' }],
  }])
  assert.deepEqual(catalog, [])
})


test('catalog normalization is idempotent for item and slide releases', () => {
  const once = normalizeNotificationCatalog(SYSTEM_NOTIFICATIONS)
  const twice = normalizeNotificationCatalog(once)
  assert.deepEqual(twice, once)
  assert.equal(twice[0].slides.length, 5)
  assert.equal(twice[1].items.length, 3)
})
