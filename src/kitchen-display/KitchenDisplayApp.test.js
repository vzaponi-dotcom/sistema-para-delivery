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
  const plays = []
  const scheduled = []
  const renderer = await h.render(KitchenDisplayApp, {
    bootstrap: async () => ({ kind: 'paired', state: state(['existing']) }),
    readState: async () => state(['existing', 'new-order']),
    audio: { unlock: async () => true, playArrival: async (options) => { plays.push(options); return true } },
    schedule: (callback, delay) => { scheduled.push({ callback, delay }); return scheduled.length },
    cancelSchedule: () => {},
  })
  await flushEffects()
  assert.equal(plays.length, 0)

  await act(async () => buttonNamed(renderer.root, 'Iniciar painel da cozinha').props.onClick())
  await act(async () => h.fireInterval(2000))
  assert.deepEqual(plays, [{ profile: 'kitchen-strong', volume: 'max' }])
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


test('paired approval reaches the start screen before evaluating order timing compatibility', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayApp } = await h.load('/src/kitchen-display/KitchenDisplayApp.jsx')
  const incompatibleState = {
    serverNow: '2026-09-22T20:00:00.000Z',
    timing: null,
    orders: [{ id: 'legacy-tv-order', status: 'Em preparo', createdAt: '2026-09-22T19:00:00.000Z' }],
  }
  const renderer = await h.render(KitchenDisplayApp, {
    bootstrap: async () => ({ kind: 'pairing', pairing: { paired: false, code: '654321' } }),
    pollPairing: async () => ({ kind: 'paired', state: incompatibleState }),
    audio: { unlock: async () => true, playArrival: async () => true },
  })
  await flushEffects()

  await act(async () => h.fireInterval(2000))
  assert.ok(buttonNamed(renderer.root, 'Iniciar painel da cozinha'))
  assert.doesNotMatch(nodeText(renderer.root), /Não foi possível preparar os pedidos nesta TV/)

  await act(async () => buttonNamed(renderer.root, 'Iniciar painel da cozinha').props.onClick())
  assert.match(nodeText(renderer.root), /Não foi possível preparar os pedidos nesta TV/)
  assert.match(nodeText(renderer.root), /Política de tempo do pedido inválida/)
})


test('activation failures after approval show a diagnostic instead of another pairing code', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayApp } = await h.load('/src/kitchen-display/KitchenDisplayApp.jsx')
  const renderer = await h.render(KitchenDisplayApp, {
    bootstrap: async () => ({ kind: 'pairing', pairing: { paired: false, code: '482731' } }),
    pollPairing: async () => {
      const error = Object.assign(new Error('Este painel não está mais autorizado.'), {
        status: 401,
        activationFailure: true,
      })
      throw error
    },
    audio: { unlock: async () => true, playArrival: async () => true },
  })
  await flushEffects()

  await act(async () => h.fireInterval(2000))

  assert.match(nodeText(renderer.root), /Não foi possível preparar os pedidos nesta TV/)
  assert.match(nodeText(renderer.root), /KDS_SESSION_ACTIVATION_401/)
  assert.doesNotMatch(nodeText(renderer.root), /482 731/)
})


test('start gesture requests fullscreen without blocking audio or panel activation', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayApp } = await h.load('/src/kitchen-display/KitchenDisplayApp.jsx')
  const events = []
  const renderer = await h.render(KitchenDisplayApp, {
    bootstrap: async () => ({ kind: 'paired', state: state(['existing']) }),
    readState: async () => state(['existing']),
    requestFullscreen: async () => { events.push('fullscreen'); return true },
    audio: { unlock: async () => { events.push('audio'); return true }, playArrival: async () => true },
  })
  await flushEffects()

  await act(async () => buttonNamed(renderer.root, 'Iniciar painel da cozinha').props.onClick())

  assert.deepEqual(events, ['fullscreen', 'audio'])
  assert.match(nodeText(renderer.root), /Painel da cozinha ativo/)
})

test('failed fullscreen request keeps KDS live and offers a manual retry action', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayApp } = await h.load('/src/kitchen-display/KitchenDisplayApp.jsx')
  let attempts = 0
  const renderer = await h.render(KitchenDisplayApp, {
    bootstrap: async () => ({ kind: 'paired', state: state([]) }),
    requestFullscreen: async () => {
      attempts += 1
      return attempts > 1
    },
    audio: { unlock: async () => true, playArrival: async () => true },
  })
  await flushEffects()

  await act(async () => buttonNamed(renderer.root, 'Iniciar painel da cozinha').props.onClick())
  await flushEffects()

  assert.match(nodeText(renderer.root), /Painel da cozinha ativo/)
  assert.ok(buttonNamed(renderer.root, 'Entrar em tela cheia'))

  await act(async () => buttonNamed(renderer.root, 'Entrar em tela cheia').props.onClick())
  await flushEffects()
  assert.equal(attempts, 2)
  assert.equal(buttonNamed(renderer.root, 'Entrar em tela cheia'), undefined)
})


test('start screen lets this TV choose, preview and persist its local alert sound', async (t) => {
  const h = await workspaceHarness(t)
  const { KitchenDisplayApp } = await h.load('/src/kitchen-display/KitchenDisplayApp.jsx')
  const previews = []
  const renderer = await h.render(KitchenDisplayApp, {
    bootstrap: async () => ({ kind: 'paired', state: state([]) }),
    audio: {
      unlock: async () => true,
      playArrival: async () => true,
      preview: async (options) => { previews.push(options); return true },
    },
  })
  await flushEffects()

  const profileGroup = renderer.root.findByProps({ role: 'radiogroup', 'aria-label': 'Toque do alerta da TV' })
  assert.equal(buttonNamed(profileGroup, 'Cozinha forte').props['aria-checked'], true)
  const volumeGroup = renderer.root.findByProps({ role: 'group', 'aria-label': 'Volume do alerta da TV' })
  assert.equal(buttonNamed(volumeGroup, 'Máximo').props['aria-pressed'], true)

  await act(async () => buttonNamed(profileGroup, 'Campainha').props.onClick())
  await act(async () => buttonNamed(volumeGroup, 'Alto').props.onClick())
  assert.equal(h.localStorage.getItem('kitchen-sound-profile'), 'bell')
  assert.equal(h.localStorage.getItem('kitchen-sound-volume'), 'high')

  await act(async () => buttonNamed(renderer.root, 'Ouvir alerta').props.onClick())
  assert.deepEqual(previews, [{ profile: 'bell', volume: 'high' }])
})
