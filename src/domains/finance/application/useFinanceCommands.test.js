import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { useFinanceCommands } from './useFinanceCommands.js'

const mountProbe = async (props) => {
  let latest
  let renderer
  function Probe(currentProps) {
    latest = useFinanceCommands(currentProps)
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

test('movement and opening-balance UI state is owned by the finance command hook', async () => {
  const probe = await mountProbe({
    api: {},
    applyOfficialEffects() {},
    writesBlocked: false,
    canManageMovements: true,
    setRequestKey() {},
    onSuccess() {},
    onError(error) { assert.fail(error?.message || 'unexpected error') },
  })

  assert.deepEqual(probe.getLatest().movementDialog, { open: false, movement: null })
  assert.equal(probe.getLatest().openingBalanceOpen, false)

  await act(async () => {
    assert.equal(probe.getLatest().openNewMovement(), true)
  })
  assert.deepEqual(probe.getLatest().movementDialog, { open: true, movement: null })

  const manual = { id: 'm-1', source: 'manual', description: 'Caixas' }
  await act(async () => {
    assert.equal(probe.getLatest().openEditMovement(manual), true)
  })
  assert.deepEqual(probe.getLatest().movementDialog, { open: true, movement: manual })

  await act(async () => {
    assert.equal(probe.getLatest().openEditMovement({ id: 'auto', source: 'order-payment' }), false)
    probe.getLatest().closeMovementDialog()
    assert.equal(probe.getLatest().openOpeningBalance(), true)
  })
  assert.deepEqual(probe.getLatest().movementDialog, { open: false, movement: null })
  assert.equal(probe.getLatest().openingBalanceOpen, true)

  await act(async () => probe.getLatest().closeOpeningBalance())
  assert.equal(probe.getLatest().openingBalanceOpen, false)
  probe.unmount()
})

test('finance commands apply only authoritative effects and preserve request keys/messages', async () => {
  const calls = []
  const effects = []
  const keys = []
  const successes = []
  const manual = { id: 'm-1', source: 'manual', description: 'Caixas' }
  const officialCreate = { id: 'm-created', source: 'manual', value: 10 }
  const officialUpdate = { id: 'm-1', source: 'manual', value: 20 }
  const officialSettings = { openingBalance: -10, openingDate: '2026-09-01' }

  const probe = await mountProbe({
    api: {
      createMovement: async (payload) => { calls.push(['createMovement', payload]); return { movement: officialCreate } },
      updateMovement: async (id, payload) => { calls.push(['updateMovement', id, payload]); return { movement: officialUpdate } },
      deleteMovement: async (id) => { calls.push(['deleteMovement', id]); return { deletedMovementId: id } },
      saveFinanceSettings: async (payload) => { calls.push(['saveFinanceSettings', payload]); return { financeSettings: officialSettings } },
    },
    applyOfficialEffects: (value) => effects.push(value),
    writesBlocked: false,
    canManageMovements: true,
    setRequestKey: (key) => keys.push(key),
    onSuccess: (message) => successes.push(message),
    onError(error) { assert.fail(error?.message || 'unexpected error') },
  })

  await act(async () => {
    assert.equal(await probe.getLatest().saveMovement({ value: 10 }), true)
  })
  await act(async () => {
    assert.equal(probe.getLatest().openEditMovement(manual), true)
  })
  await act(async () => {
    assert.equal(await probe.getLatest().saveMovement({ value: 20 }), true)
    assert.equal(await probe.getLatest().deleteMovement('m-1'), true)
    assert.equal(await probe.getLatest().saveOpeningBalance(officialSettings), true)
  })

  assert.deepEqual(calls, [
    ['createMovement', { value: 10 }],
    ['updateMovement', 'm-1', { value: 20 }],
    ['deleteMovement', 'm-1'],
    ['saveFinanceSettings', officialSettings],
  ])
  assert.deepEqual(effects, [
    { movement: officialCreate },
    { movement: officialUpdate },
    { deletedMovementId: 'm-1' },
    { financeSettings: officialSettings },
  ])
  assert.deepEqual(keys, [
    'movement:create', null,
    'movement:update:m-1', null,
    'movement:delete:m-1', null,
    'finance-settings:save', null,
  ])
  assert.deepEqual(successes, [
    'Movimentação registrada com sucesso',
    'Movimentação atualizada com sucesso',
    'Movimentação excluída com sucesso',
    'Saldo inicial atualizado com sucesso',
  ])
  probe.unmount()
})

test('write and capability guards block finance UI and API commands', async () => {
  let apiCalls = 0
  const api = {
    createMovement: async () => { apiCalls += 1; return {} },
    updateMovement: async () => { apiCalls += 1; return {} },
    deleteMovement: async () => { apiCalls += 1; return {} },
    saveFinanceSettings: async () => { apiCalls += 1; return {} },
  }
  const common = {
    api,
    applyOfficialEffects() {},
    setRequestKey() {},
    onSuccess() {},
    onError() {},
  }

  for (const props of [
    { writesBlocked: true, canManageMovements: true },
    { writesBlocked: false, canManageMovements: false },
  ]) {
    const probe = await mountProbe({ ...common, ...props })
    await act(async () => {
      assert.equal(probe.getLatest().openNewMovement(), false)
      assert.equal(probe.getLatest().openEditMovement({ id: 'm-1', source: 'manual' }), false)
      assert.equal(probe.getLatest().openOpeningBalance(), false)
      assert.equal(await probe.getLatest().saveMovement({ value: 10 }), false)
      assert.equal(await probe.getLatest().deleteMovement('m-1'), false)
      assert.equal(await probe.getLatest().saveOpeningBalance({ openingBalance: 0 }), false)
    })
    probe.unmount()
  }

  assert.equal(apiCalls, 0)
})
