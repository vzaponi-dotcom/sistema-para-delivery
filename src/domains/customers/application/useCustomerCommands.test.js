import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useCustomerCommands } from './useCustomerCommands.js'

const mountProbe = async (props) => {
  let latest
  let renderer
  function Probe(currentProps) {
    latest = useCustomerCommands(currentProps)
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

test('customer commands preserve request keys, authoritative effects and success feedback', async () => {
  const calls = []
  const effects = []
  const keys = []
  const successes = []
  const created = { id: 'c-new', name: 'Maria' }
  const quick = { id: 'c-quick', name: 'João' }
  const updated = { id: 'c-1', name: 'Maria Silva' }

  const probe = await mountProbe({
    api: {
      createClient: async (payload) => {
        calls.push(['createClient', payload])
        return { client: payload.name === 'João' ? quick : created }
      },
      updateClient: async (id, payload) => {
        calls.push(['updateClient', id, payload])
        return { client: updated }
      },
      deleteClient: async (id) => {
        calls.push(['deleteClient', id])
        return { deleted: true }
      },
    },
    applyOfficialEffects: (value) => effects.push(value),
    writesBlocked: false,
    canManageClients: true,
    setRequestKey: (key) => keys.push(key),
    onSuccess: (message) => successes.push(message),
    onError(error) { assert.fail(error?.message || 'unexpected error') },
  })

  await act(async () => {
    assert.equal((await probe.getLatest().createClient({ name: 'Maria' }))?.id, 'c-new')
    assert.equal((await probe.getLatest().quickCreateClient({ name: 'João' }))?.id, 'c-quick')
    assert.equal((await probe.getLatest().updateClient('c-1', { name: 'Maria Silva' }))?.id, 'c-1')
    assert.equal(await probe.getLatest().deleteClient('c-1'), true)
  })

  assert.deepEqual(calls, [
    ['createClient', { name: 'Maria' }],
    ['createClient', { name: 'João' }],
    ['updateClient', 'c-1', { name: 'Maria Silva' }],
    ['deleteClient', 'c-1'],
  ])
  assert.deepEqual(effects, [
    { client: created },
    { client: quick },
    { client: updated },
    { deletedClientId: 'c-1' },
  ])
  assert.deepEqual(keys, [
    'client:create', null,
    'client:create:quick', null,
    'client:update:c-1', null,
    'client:delete:c-1', null,
  ])
  assert.deepEqual(successes, [
    'Cliente adicionado com sucesso',
    'Cliente atualizado com sucesso',
    'Cliente excluído com sucesso',
  ])

  probe.unmount()
})

test('customer commands refuse every write when offline/global writes are blocked or capability is missing', async () => {
  let apiCalls = 0
  const api = {
    createClient: async () => { apiCalls += 1; return {} },
    updateClient: async () => { apiCalls += 1; return {} },
    deleteClient: async () => { apiCalls += 1; return {} },
  }
  const common = {
    api,
    applyOfficialEffects() {},
    setRequestKey() {},
    onSuccess() {},
    onError() {},
  }

  for (const props of [
    { writesBlocked: true, canManageClients: true },
    { writesBlocked: false, canManageClients: false },
  ]) {
    const probe = await mountProbe({ ...common, ...props })
    await act(async () => {
      assert.equal(await probe.getLatest().createClient({ name: 'X' }), null)
      assert.equal(await probe.getLatest().quickCreateClient({ name: 'X' }), null)
      assert.equal(await probe.getLatest().updateClient('c-1', { name: 'X' }), null)
      assert.equal(await probe.getLatest().deleteClient('c-1'), false)
    })
    probe.unmount()
  }

  assert.equal(apiCalls, 0)
})
