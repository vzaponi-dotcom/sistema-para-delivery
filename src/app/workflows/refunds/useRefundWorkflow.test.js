import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useRefundWorkflow } from './useRefundWorkflow.js'

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}

const sourceOrder = (overrides = {}) => ({
  id: 'order-1',
  paymentMethod: 'Pix',
  paidAmount: 40,
  ...overrides,
})

async function mountWorkflow(overrides = {}) {
  let latest
  let renderer
  const calls = []
  const effects = []
  const successes = []
  const errors = []
  const pending = overrides.pending || deferred()
  const props = {
    api: {
      refundOrder: async (...args) => {
        calls.push(args)
        return pending.promise
      },
    },
    canRefundPayments: true,
    writesBlocked: false,
    applyOfficialEffects: (effect) => effects.push(effect),
    onSuccess: (message) => successes.push(message),
    onError: (error) => errors.push(error),
    ...overrides,
  }

  function Probe(currentProps) {
    latest = useRefundWorkflow(currentProps)
    return null
  }

  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe, props))
  })

  return { getLatest: () => latest, calls, effects, successes, errors, pending, unmount: () => renderer.unmount() }
}

test('request selects the order, applies official effects once, succeeds, and clears target', async () => {
  const official = { order: { id: 'order-1', status: 'Cancelado' }, movement: { id: 'movement-1' } }
  const probe = await mountWorkflow({
    api: { refundOrder: async (...args) => { probe.calls.push(args); return official } },
  })
  const order = sourceOrder()

  await act(async () => assert.equal(probe.getLatest().request(order), true))
  assert.equal(probe.getLatest().refundOrder, order)
  await act(async () => assert.equal(await probe.getLatest().confirm({ refundMethod: 'Pix' }), true))

  assert.equal(probe.calls.length, 1)
  assert.deepEqual(probe.effects, [official])
  assert.deepEqual(probe.successes, ['Estorno registrado com sucesso'])
  assert.equal(probe.getLatest().refundOrder, null)
  probe.unmount()
})

test('double confirm while submitting sends one POST', async () => {
  const probe = await mountWorkflow()
  await act(async () => probe.getLatest().request(sourceOrder()))
  let first
  await act(async () => {
    first = probe.getLatest().confirm({ refundMethod: 'Pix' })
    assert.equal(await probe.getLatest().confirm({ refundMethod: 'Pix' }), false)
  })
  assert.equal(probe.calls.length, 1)
  await act(async () => { probe.pending.resolve({ order: {}, movement: {} }); assert.equal(await first, true) })
  probe.unmount()
})

test('error preserves target and calls existing error feedback', async () => {
  const error = new Error('refund failed')
  const probe = await mountWorkflow({ api: { refundOrder: async () => { throw error } } })
  const order = sourceOrder()
  await act(async () => probe.getLatest().request(order))
  await act(async () => assert.equal(await probe.getLatest().confirm({ refundMethod: 'Pix' }), false))
  assert.equal(probe.getLatest().refundOrder, order)
  assert.deepEqual(probe.errors, [error])
  probe.unmount()
})

test('capability and offline guards block writing', async () => {
  for (const overrides of [{ canRefundPayments: false }, { writesBlocked: true }]) {
    const probe = await mountWorkflow(overrides)
    const order = sourceOrder()
    await act(async () => assert.equal(probe.getLatest().request(order), false))
    assert.equal(probe.getLatest().refundOrder, null)
    assert.equal(probe.calls.length, 0)
    probe.unmount()
  }
})
