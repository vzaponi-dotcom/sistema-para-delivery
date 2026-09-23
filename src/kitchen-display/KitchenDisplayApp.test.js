import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'

import { buttonNamed, nodeText, workspaceHarness } from '../test-support/renderWorkspace.js'

const state = (ids = []) => ({
  serverNow: '2026-09-22T20:00:00.000Z',
  timing: { scheduledPrepLeadMinutes: 50, scheduledLateGraceMinutes: 15, immediateLateAfterMinutes: 30, immediateVeryLateAfterMinutes: 60 },
  orders: ids.map((id) => ({ id, status: 'Em preparo', createdAt: '2026-09-22T19:00:00.000Z' })),
})
const flushEffects = () => act(async () => {
  await Promise.resolve()
  await Promise.resolve()
})

test('paired TV enters the live panel automatically and only treats audio unlock as a best-effort enhancement', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayApp } = await h.load('/src/kitchen-display/KitchenDisplayApp.jsx')
  const events = []
  const renderer = await h.render(KitchenDisplayApp, {
    bootstrap: async () => ({ kind: 'paired', state: state(['existing']) }),
    readState: async () => state(['existing']),
    audio: { unlock: async () => { events.push('audio'); return true }, playArrival: async () => true },
  })
  await flushEffects()
  assert.deepEqual(events, ['audio'])
  assert.equal(buttonNamed(renderer.root, 'Iniciar painel da cozinha'), undefined)
  assert.match(nodeText(renderer.root), /Painel da cozinha ativo/)
})

test('live runtime polls only while visible and refreshes immediately on focus, online and visible', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayApp } = await h.load('/src/kitchen-display/KitchenDisplayApp.jsx')
  let reads = 0
  const renderer = await h.render(KitchenDisplayApp, {
    bootstrap: async () => ({ kind: 'paired', state: state([]) }),
    readState: async () => { reads += 1; return state([]) },
    audio: { unlock: async () => true, playArrival: async () => true },
    requestFullscreen: async () => {},
  })
  await flushEffects()

  await act(async () => h.fireInterval(2000))
  assert.equal(reads, 1)
  h.setVisibility('hidden')
  await act(async () => h.fireInterval(2000))
  assert.equal(reads, 1)
  await act(async () => h.window.dispatchEvent(new Event('focus')))
  await act(async () => h.window.dispatchEvent(new Event('online')))
  assert.equal(reads, 3)
  h.setVisibility('visible')
  await act(async () => h.document.dispatchEvent(new Event('visibilitychange')))
  assert.equal(reads, 4)
})

test('new arrivals alert once and highlight for exactly 2600ms; initial orders stay quiet', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayApp } = await h.load('/src/kitchen-display/KitchenDisplayApp.jsx')
  let plays = 0
  const scheduled = []
  const renderer = await h.render(KitchenDisplayApp, {
    bootstrap: async () => ({ kind: 'paired', state: state(['existing']) }),
    readState: async () => state(['existing', 'new-order']),
    audio: { unlock: async () => true, playArrival: async () => { plays += 1; return true } },
    requestFullscreen: async () => {},
    schedule: (callback, delay) => { scheduled.push({ callback, delay }); return scheduled.length },
    cancelSchedule: () => {},
  })
  await flushEffects()
  assert.equal(plays, 0)
  await act(async () => h.fireInterval(2000))
  assert.equal(plays, 1)
  assert.deepEqual(renderer.root.findByProps({ 'data-order-id': 'new-order' }).props['data-highlighted'], true)
  assert.equal(scheduled[0].delay, 2600)
  await act(async () => scheduled[0].callback())
  assert.equal(renderer.root.findByProps({ 'data-order-id': 'new-order' }).props['data-highlighted'], false)
})

test('transient failures preserve stale snapshot; 401 clears it and audio fallback remains actionable', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayApp } = await h.load('/src/kitchen-display/KitchenDisplayApp.jsx')
  const { KitchenDisplayHttpError } = await h.load('/src/kitchen-display/kitchenDisplayApi.js')
  const responses = [new Error('offline'), new KitchenDisplayHttpError(401, 'revoked')]
  const renderer = await h.render(KitchenDisplayApp, {
    bootstrap: async () => ({ kind: 'paired', state: state(['keep-me']) }),
    readState: async () => { throw responses.shift() },
    audio: { unlock: async () => false, playArrival: async () => false },
    requestFullscreen: async () => {},
  })
  await flushEffects()
  assert.ok(buttonNamed(renderer.root, 'Ativar alertas sonoros'))
  await act(async () => h.fireInterval(2000))
  assert.match(nodeText(renderer.root), /Dados temporariamente desatualizados/)
  assert.ok(renderer.root.findByProps({ 'data-order-id': 'keep-me' }))
  await act(async () => h.fireInterval(2000))
  assert.match(nodeText(renderer.root), /Painel não autorizado/)
  assert.equal(renderer.root.findAllByProps({ 'data-order-id': 'keep-me' }).length, 0)
})

test('unpaired TV shows a six-digit code and advances automatically after approval', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayApp } = await h.load('/src/kitchen-display/KitchenDisplayApp.jsx')
  const renderer = await h.render(KitchenDisplayApp, {
    bootstrap: async () => ({ kind: 'pairing', pairing: { paired: false, code: '482731', expiresAt: '2026-09-22T20:30:00.000Z' } }),
    pollPairing: async () => ({ kind: 'paired', state: state([]) }),
    readState: async () => state([]),
    audio: { unlock: async () => true, playArrival: async () => true },
    requestFullscreen: async () => {},
  })
  await flushEffects()
  assert.match(nodeText(renderer.root), /Conectar esta TV/)
  assert.match(nodeText(renderer.root), /482 731/)
  await act(async () => h.fireInterval(2000))
  assert.equal(buttonNamed(renderer.root, 'Iniciar painel da cozinha'), undefined)
  assert.match(nodeText(renderer.root), /Painel da cozinha ativo/)
})
