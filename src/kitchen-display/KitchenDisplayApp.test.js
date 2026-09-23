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

test('paired TV waits for one start gesture so audio can unlock before kitchen use', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayApp } = await h.load('/src/kitchen-display/KitchenDisplayApp.jsx')
  const events = []
  const renderer = await h.render(KitchenDisplayApp, {
    bootstrap: async () => ({ kind: 'paired', state: state(['existing']) }),
    readState: async () => state(['existing']),
    audio: { unlock: async () => { events.push('audio'); return true }, playArrival: async () => true },
  })
  await flushEffects()

  assert.deepEqual(events, [])
  assert.ok(buttonNamed(renderer.root, 'Iniciar painel da cozinha'))
  assert.doesNotMatch(nodeText(renderer.root), /Painel da cozinha ativo/)

  await act(async () => buttonNamed(renderer.root, 'Iniciar painel da cozinha').props.onClick())
  assert.deepEqual(events, ['audio'])
  assert.match(nodeText(renderer.root), /Painel da cozinha ativo/)
})

test('live runtime polls only after the start gesture and only while visible', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayApp } = await h.load('/src/kitchen-display/KitchenDisplayApp.jsx')
  let reads = 0
  const renderer = await h.render(KitchenDisplayApp, {
    bootstrap: async () => ({ kind: 'paired', state: state([]) }),
    readState: async () => { reads += 1; return state([]) },
    audio: { unlock: async () => true, playArrival: async () => true },
  })
  await flushEffects()

  await act(async () => h.fireInterval(2000))
  assert.equal(reads, 0)

  await act(async () => buttonNamed(renderer.root, 'Iniciar painel da cozinha').props.onClick())
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
    schedule: (callback, delay) => { scheduled.push({ callback, delay }); return scheduled.length },
    cancelSchedule: () => {},
  })
  await flushEffects()
  assert.equal(plays, 0)

  await act(async () => buttonNamed(renderer.root, 'Iniciar painel da cozinha').props.onClick())
  await act(async () => h.fireInterval(2000))
  assert.equal(plays, 1)
  assert.deepEqual(renderer.root.findByProps({ 'data-order-id': 'new-order' }).props['data-highlighted'], true)
  assert.equal(scheduled[0].delay, 2600)
  await act(async () => scheduled[0].callback())
  assert.equal(renderer.root.findByProps({ 'data-order-id': 'new-order' }).props['data-highlighted'], false)
})

test('failed audio unlock keeps the panel available and exposes the sound recovery action', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayApp } = await h.load('/src/kitchen-display/KitchenDisplayApp.jsx')
  const { KitchenDisplayHttpError } = await h.load('/src/kitchen-display/kitchenDisplayApi.js')
  const responses = [new Error('offline'), new KitchenDisplayHttpError(401, 'revoked')]
  const renderer = await h.render(KitchenDisplayApp, {
    bootstrap: async () => ({ kind: 'paired', state: state(['keep-me']) }),
    readState: async () => { throw responses.shift() },
    audio: { unlock: async () => false, playArrival: async () => false },
  })
  await flushEffects()
  await act(async () => buttonNamed(renderer.root, 'Iniciar painel da cozinha').props.onClick())

  assert.match(nodeText(renderer.root), /Painel da cozinha ativo/)
  assert.ok(buttonNamed(renderer.root, 'Ativar alertas sonoros'))

  await act(async () => h.fireInterval(2000))
  assert.match(nodeText(renderer.root), /Dados temporariamente desatualizados/)
  assert.ok(renderer.root.findByProps({ 'data-order-id': 'keep-me' }))
  await act(async () => h.fireInterval(2000))
  assert.match(nodeText(renderer.root), /Painel não autorizado/)
  assert.equal(renderer.root.findAllByProps({ 'data-order-id': 'keep-me' }).length, 0)
})

test('paired approval advances from code to the explicit start screen', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayApp } = await h.load('/src/kitchen-display/KitchenDisplayApp.jsx')
  const renderer = await h.render(KitchenDisplayApp, {
    bootstrap: async () => ({ kind: 'pairing', pairing: { paired: false, code: '482731', expiresAt: '2026-09-22T20:30:00.000Z' } }),
    pollPairing: async () => ({ kind: 'paired', state: state([]) }),
    readState: async () => state([]),
    audio: { unlock: async () => true, playArrival: async () => true },
  })
  await flushEffects()
  assert.match(nodeText(renderer.root), /Conectar esta TV/)
  assert.match(nodeText(renderer.root), /482 731/)

  await act(async () => h.fireInterval(2000))
  assert.ok(buttonNamed(renderer.root, 'Iniciar painel da cozinha'))
  assert.doesNotMatch(nodeText(renderer.root), /Painel da cozinha ativo/)

  await act(async () => buttonNamed(renderer.root, 'Iniciar painel da cozinha').props.onClick())
  assert.match(nodeText(renderer.root), /Painel da cozinha ativo/)
})

test('an audio unlock that never settles cannot trap the user after the explicit click', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayApp } = await h.load('/src/kitchen-display/KitchenDisplayApp.jsx')
  const never = new Promise(() => {})
  const renderer = await h.render(KitchenDisplayApp, {
    bootstrap: async () => ({ kind: 'paired', state: state(['existing']) }),
    readState: async () => state(['existing']),
    audio: { unlock: async () => never, playArrival: async () => true },
  })
  await flushEffects()

  await act(async () => buttonNamed(renderer.root, 'Iniciar painel da cozinha').props.onClick())
  assert.match(nodeText(renderer.root), /Painel da cozinha ativo/)
})
