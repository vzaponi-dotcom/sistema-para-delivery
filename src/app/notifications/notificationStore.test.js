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
