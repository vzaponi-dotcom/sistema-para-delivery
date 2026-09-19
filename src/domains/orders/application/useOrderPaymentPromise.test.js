import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useOrderPaymentPromise } from './useOrderPaymentPromise.js'

const mountProbe = async (props) => {
  let latest
  let renderer
  function Probe(currentProps) {
    latest = useOrderPaymentPromise(currentProps)
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

test('payment promise applies only the authoritative order and preserves request key/messages', async () => {
  const calls = []
  const effects = []
  const keys = []
  const successes = []
  const officialOrder = { id: 'o1', promisedPaymentDate: '2026-09-20' }
  const api = {
    updatePaymentPromise: async (...args) => {
      calls.push(args)
      return { order: officialOrder }
    },
  }
  const probe = await mountProbe({
    api,
    applyOfficialEffects: (effect) => effects.push(effect),
    writesBlocked: false,
    canManagePaymentPromises: true,
    setRequestKey: (key) => keys.push(key),
    onSuccess: (message) => successes.push(message),
    onError(error) { assert.fail(error?.message || 'unexpected error') },
  })

  await act(async () => {
    assert.equal(await probe.getLatest().updatePaymentPromise('o1', '2026-09-20'), true)
  })

  assert.deepEqual(calls, [['o1', '2026-09-20']])
  assert.deepEqual(effects, [{ order: officialOrder }])
  assert.deepEqual(keys, ['payment-promise:o1', null])
  assert.deepEqual(successes, ['Data prometida atualizada'])

  await act(async () => {
    assert.equal(await probe.getLatest().updatePaymentPromise('o1', null), true)
  })
  assert.equal(successes.at(-1), 'Data prometida removida')
  probe.unmount()
})

test('payment promise guards block writes before the API', async () => {
  let calls = 0
  const common = {
    api: { updatePaymentPromise: async () => { calls += 1; return { order: {} } } },
    applyOfficialEffects() {},
    setRequestKey() {},
    onSuccess() {},
    onError() {},
  }

  for (const props of [
    { writesBlocked: true, canManagePaymentPromises: true },
    { writesBlocked: false, canManagePaymentPromises: false },
  ]) {
    const probe = await mountProbe({ ...common, ...props })
    await act(async () => {
      assert.equal(await probe.getLatest().updatePaymentPromise('o1', '2026-09-20'), false)
    })
    probe.unmount()
  }

  assert.equal(calls, 0)
})
