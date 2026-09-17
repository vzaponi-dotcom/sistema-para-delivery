import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useNewOrderDraft } from './useNewOrderDraft.js'

const deferred = () => {
  let resolve
  const promise = new Promise((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}

const mountProbe = async (props) => {
  let latest
  let renderer
  function Probe(currentProps) {
    latest = useNewOrderDraft(currentProps)
    return null
  }
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe, props))
  })
  return {
    getLatest: () => latest,
    unmount: () => renderer.unmount(),
  }
}

test('stale checkout cannot commit after a newer draft opens', async () => {
  const pending = deferred()
  const committed = []
  const probe = await mountProbe({
    submitOrder: async () => pending.promise,
    canSubmit: () => true,
    commitOfficialEffects: (result) => committed.push(result),
    onCommitted: async () => {},
    onSuccess: () => {},
    onError: () => {},
    onConflict: async () => {},
  })

  await act(async () => { probe.getLatest().open({ returnDestination: 'orders' }) })
  let firstPromise
  await act(async () => {
    firstPromise = probe.getLatest().submit({ client: 'Ana' })
    await Promise.resolve()
  })
  await act(async () => { probe.getLatest().open({ returnDestination: 'comandas' }) })
  pending.resolve({ order: { id: 'o-1', status: 'Em preparo' } })
  await act(async () => { await firstPromise })

  assert.equal(committed.length, 0)
  assert.equal(probe.getLatest().context.returnDestination, 'comandas')
  probe.unmount()
})

test('current checkout commits before callbacks and clears the draft', async () => {
  const events = []
  const order = { id: 'o-2', status: 'Em preparo' }
  const probe = await mountProbe({
    submitOrder: async () => ({ order }),
    canSubmit: () => true,
    commitOfficialEffects: () => events.push('commit'),
    onCommitted: async () => { events.push('committed') },
    onSuccess: () => events.push('success'),
    onError: () => events.push('error'),
    onConflict: async () => {},
  })

  await act(async () => { probe.getLatest().open({ returnDestination: 'orders' }) })
  let result
  await act(async () => { result = await probe.getLatest().submit({ client: 'Ana' }) })

  assert.equal(result, true)
  assert.deepEqual(events, ['commit', 'committed', 'success'])
  assert.equal(probe.getLatest().context, null)
  assert.equal(probe.getLatest().checkoutPending, false)
  probe.unmount()
})
