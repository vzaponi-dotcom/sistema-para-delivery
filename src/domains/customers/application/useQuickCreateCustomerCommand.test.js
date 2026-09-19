import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { useQuickCreateCustomerCommand } from './useQuickCreateCustomerCommand.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

async function mount(overrides = {}) {
  let command
  const calls = { payloads: [], keys: [], effects: [], errors: [] }
  const client = { id: 'new-client', name: 'Joana Lima', phone: '', address: '' }
  const props = {
    api: {
      createClient: async (payload) => {
        calls.payloads.push(payload)
        return { client: { ...client, ...payload } }
      },
    },
    canManageClients: true,
    writesBlocked: false,
    applyOfficialEffects: (effects) => calls.effects.push(effects),
    setRequestKey: (key) => calls.keys.push(key),
    onError: (error) => calls.errors.push(error),
    ...overrides,
  }

  function Probe() {
    command = useQuickCreateCustomerCommand(props)
    return null
  }

  let renderer
  await act(async () => { renderer = create(React.createElement(Probe)) })
  return { get command() { return command }, calls, renderer }
}

test('quick-create normalizes its dedicated payload and preserves the global request key/effect', async () => {
  const h = await mount()
  let result

  await act(async () => {
    result = await h.command({ name: '  Joana Lima  ', phone: '' })
  })

  assert.deepEqual(h.calls.payloads, [{ name: 'Joana Lima', phone: '', address: '' }])
  assert.deepEqual(h.calls.keys, ['client:create:quick', null])
  assert.equal(h.calls.effects.length, 1)
  assert.equal(h.calls.effects[0].client.name, 'Joana Lima')
  assert.equal(result.name, 'Joana Lima')
  assert.deepEqual(h.calls.errors, [])

  h.renderer.unmount()
})

test('quick-create refuses missing capability, blocked writes and blank names before mutation', async () => {
  for (const overrides of [
    { canManageClients: false },
    { writesBlocked: true },
  ]) {
    const h = await mount(overrides)
    let result
    await act(async () => { result = await h.command({ name: 'Joana', phone: '11999999999' }) })
    assert.equal(result, null)
    assert.deepEqual(h.calls.payloads, [])
    assert.deepEqual(h.calls.keys, [])
    h.renderer.unmount()
  }

  const h = await mount()
  let result
  await act(async () => { result = await h.command({ name: '   ', phone: '' }) })
  assert.equal(result, null)
  assert.deepEqual(h.calls.payloads, [])
  assert.deepEqual(h.calls.keys, [])
  h.renderer.unmount()
})
