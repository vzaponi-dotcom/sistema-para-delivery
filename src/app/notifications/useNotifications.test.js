import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useNotifications } from './useNotifications.js'

const release = (id, day) => ({ id, type: 'release', publishedAt: `2026-09-${day}T20:00:00-03:00`, title: id, summary: id })
const storage = () => {
  const data = new Map()
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
}

test('controller preserves presented/read distinction, persistence, and business isolation', async () => {
  const device = storage()
  const catalog = [release('new', '21'), release('old', '01')]
  let latest
  function Probe(props) { latest = useNotifications(props); return null }
  let renderer
  await act(async () => { renderer = TestRenderer.create(React.createElement(Probe, { businessId: 'a', catalog, storage: device })) })
  assert.equal(latest.automaticNotification.id, 'new')
  assert.equal(latest.unreadCount, 1)
  await act(async () => latest.markPresented('new'))
  assert.equal(latest.automaticNotification, null)
  assert.equal(latest.unreadCount, 1)
  await act(async () => latest.markRead('new'))
  assert.equal(latest.unreadCount, 0)
  await act(async () => renderer.unmount())
  await act(async () => { renderer = TestRenderer.create(React.createElement(Probe, { businessId: 'a', catalog, storage: device })) })
  assert.equal(latest.unreadCount, 0)
  await act(async () => renderer.update(React.createElement(Probe, { businessId: 'b', catalog, storage: device })))
  assert.equal(latest.unreadCount, 1)
  assert.equal(latest.automaticNotification.id, 'new')
  await act(async () => renderer.unmount())
})

test('two later releases remain unread while only newest can auto-open', async () => {
  const device = storage()
  let latest
  function Probe(props) { latest = useNotifications(props); return null }
  let renderer
  await act(async () => { renderer = TestRenderer.create(React.createElement(Probe, { businessId: 'a', catalog: [release('old', '01')], storage: device })) })
  await act(async () => latest.markRead('old'))
  const expanded = [release('newest', '22'), release('newer', '21'), release('old', '01')]
  await act(async () => renderer.update(React.createElement(Probe, { businessId: 'a', catalog: expanded, storage: device })))
  assert.equal(latest.automaticNotification.id, 'newest')
  assert.equal(latest.unreadCount, 2)
  await act(async () => latest.markPresented('newest'))
  assert.equal(latest.automaticNotification, null)
  assert.equal(latest.unreadCount, 2)
  await act(async () => renderer.unmount())
})

test('write failures keep state changes in memory', async () => {
  const device = { getItem: () => null, setItem: () => { throw new Error('quota') } }
  let latest
  function Probe() { latest = useNotifications({ businessId: 'a', catalog: [release('new', '21')], storage: device }); return null }
  let renderer
  await act(async () => { renderer = TestRenderer.create(React.createElement(Probe)) })
  await act(async () => latest.markRead('new'))
  assert.equal(latest.unreadCount, 0)
  await act(async () => renderer.unmount())
})
